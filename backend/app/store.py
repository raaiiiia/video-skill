import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from urllib.parse import urlparse

from .models import EvidenceItem, JobStatus, OperationCandidate, Skill, VideoLinkAnalysisRequest


_LOCK = Lock()


def _default_db_path() -> Path:
    configured = os.getenv("VIDEO_SKILL_DB_PATH")
    if configured:
        return Path(configured)
    if os.getenv("VERCEL"):
        return Path("/tmp/video_skill.db")
    return Path(__file__).resolve().parents[2] / "data" / "video_skill.db"


DB_PATH = _default_db_path()


def _database_url() -> str | None:
    return os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")


def _using_postgres() -> bool:
    return bool(_database_url())


def _safe_database_label() -> str:
    database_url = _database_url()
    if not database_url:
        return str(DB_PATH)

    parsed = urlparse(database_url)
    if parsed.hostname:
        return f"{parsed.scheme}://{parsed.hostname}{parsed.path}"
    return "postgres"


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _to_json(model: object) -> str:
    if hasattr(model, "model_dump"):
        payload = model.model_dump(mode="json")  # type: ignore[attr-defined]
    elif hasattr(model, "dict"):
        payload = model.dict()  # type: ignore[attr-defined]
    else:
        payload = model
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def _from_json(model_type, value: str):
    payload = json.loads(value)
    if hasattr(model_type, "model_validate"):
        return model_type.model_validate(payload)
    return model_type.parse_obj(payload)


@contextmanager
def _connect_sqlite():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=MEMORY")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


@contextmanager
def _connect_postgres():
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as exc:
        raise RuntimeError(
            "Postgres persistence requires psycopg. Add psycopg[binary] to requirements.txt."
        ) from exc

    database_url = _database_url()
    if not database_url:
        raise RuntimeError("DATABASE_URL or POSTGRES_URL is required for Postgres persistence.")

    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        yield connection


def _sqlite_schema_sql() -> str:
    return """
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL,
      message TEXT NOT NULL,
      source_url TEXT,
      source_kind TEXT,
      provider TEXT,
      resolved_media_url TEXT,
      evidence_score INTEGER NOT NULL DEFAULT 0,
      needs_review INTEGER NOT NULL DEFAULT 1,
      suggestions_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      source_url TEXT,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (id, job_id)
    );

    CREATE TABLE IF NOT EXISTS operations (
      id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (id, job_id)
    );

    CREATE INDEX IF NOT EXISTS idx_skills_source_url ON skills(source_url);
    CREATE INDEX IF NOT EXISTS idx_evidence_job_id ON evidence(job_id);
    CREATE INDEX IF NOT EXISTS idx_operations_job_id ON operations(job_id);

    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    """


def _postgres_schema_sql() -> tuple[str, ...]:
    return (
        """
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          progress INTEGER NOT NULL,
          message TEXT NOT NULL,
          source_url TEXT,
          source_kind TEXT,
          provider TEXT,
          resolved_media_url TEXT,
          evidence_score INTEGER NOT NULL DEFAULT 0,
          needs_review BOOLEAN NOT NULL DEFAULT TRUE,
          suggestions_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS skills (
          id TEXT PRIMARY KEY,
          job_id TEXT,
          source_url TEXT,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS evidence (
          id TEXT NOT NULL,
          job_id TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (id, job_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS operations (
          id TEXT NOT NULL,
          job_id TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (id, job_id)
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_skills_source_url ON skills(source_url)",
        "CREATE INDEX IF NOT EXISTS idx_evidence_job_id ON evidence(job_id)",
        "CREATE INDEX IF NOT EXISTS idx_operations_job_id ON operations(job_id)",
        """
        CREATE TABLE IF NOT EXISTS users (
          email TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """,
    )


def _remove_empty_database_artifacts() -> bool:
    if not DB_PATH.exists() or DB_PATH.stat().st_size > 0:
        return False

    journal_path = Path(f"{DB_PATH}-journal")
    try:
        DB_PATH.unlink(missing_ok=True)
        journal_path.unlink(missing_ok=True)
        return True
    except PermissionError:
        return False


def _switch_to_recovery_database() -> bool:
    global DB_PATH

    if DB_PATH.exists() and DB_PATH.stat().st_size > 0:
        return False
    DB_PATH = DB_PATH.with_name(f"{DB_PATH.stem}.runtime{DB_PATH.suffix}")
    return True


def _create_sqlite_schema() -> None:
    with _LOCK, _connect_sqlite() as db:
        db.executescript(_sqlite_schema_sql())


def _create_postgres_schema() -> None:
    with _LOCK, _connect_postgres() as db:
        for statement in _postgres_schema_sql():
            db.execute(statement)


def init_store() -> None:
    if _using_postgres():
        _create_postgres_schema()
        return

    try:
        _create_sqlite_schema()
    except sqlite3.OperationalError as exc:
        if "disk I/O" not in str(exc):
            raise
        if not _remove_empty_database_artifacts() and not _switch_to_recovery_database():
            raise
        _create_sqlite_schema()


def save_job(
    job: JobStatus,
    payload: VideoLinkAnalysisRequest | None = None,
    *,
    provider: str | None = None,
    resolved_media_url: str | None = None,
    evidence_score: int = 0,
    needs_review: bool = True,
    suggestions: list[str] | None = None,
) -> None:
    init_store()
    if _using_postgres():
        _save_job_postgres(
            job,
            payload,
            provider=provider,
            resolved_media_url=resolved_media_url,
            evidence_score=evidence_score,
            needs_review=needs_review,
            suggestions=suggestions,
        )
        return

    _save_job_sqlite(
        job,
        payload,
        provider=provider,
        resolved_media_url=resolved_media_url,
        evidence_score=evidence_score,
        needs_review=needs_review,
        suggestions=suggestions,
    )


def _save_job_sqlite(
    job: JobStatus,
    payload: VideoLinkAnalysisRequest | None = None,
    *,
    provider: str | None = None,
    resolved_media_url: str | None = None,
    evidence_score: int = 0,
    needs_review: bool = True,
    suggestions: list[str] | None = None,
) -> None:
    timestamp = _now()
    with _LOCK, _connect_sqlite() as db:
        db.execute(
            """
            INSERT INTO jobs (
              id, status, progress, message, source_url, source_kind, provider,
              resolved_media_url, evidence_score, needs_review, suggestions_json,
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              status=excluded.status,
              progress=excluded.progress,
              message=excluded.message,
              source_url=COALESCE(excluded.source_url, jobs.source_url),
              source_kind=COALESCE(excluded.source_kind, jobs.source_kind),
              provider=COALESCE(excluded.provider, jobs.provider),
              resolved_media_url=COALESCE(excluded.resolved_media_url, jobs.resolved_media_url),
              evidence_score=excluded.evidence_score,
              needs_review=excluded.needs_review,
              suggestions_json=excluded.suggestions_json,
              updated_at=excluded.updated_at
            """,
            (
                job.id,
                job.status,
                job.progress,
                job.message,
                payload.source_url if payload else None,
                payload.source_kind if payload else None,
                provider,
                resolved_media_url,
                evidence_score,
                1 if needs_review else 0,
                json.dumps(suggestions or [], ensure_ascii=False),
                timestamp,
                timestamp,
            ),
        )


def _save_job_postgres(
    job: JobStatus,
    payload: VideoLinkAnalysisRequest | None = None,
    *,
    provider: str | None = None,
    resolved_media_url: str | None = None,
    evidence_score: int = 0,
    needs_review: bool = True,
    suggestions: list[str] | None = None,
) -> None:
    timestamp = _now()
    with _LOCK, _connect_postgres() as db:
        db.execute(
            """
            INSERT INTO jobs (
              id, status, progress, message, source_url, source_kind, provider,
              resolved_media_url, evidence_score, needs_review, suggestions_json,
              created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT(id) DO UPDATE SET
              status=excluded.status,
              progress=excluded.progress,
              message=excluded.message,
              source_url=COALESCE(excluded.source_url, jobs.source_url),
              source_kind=COALESCE(excluded.source_kind, jobs.source_kind),
              provider=COALESCE(excluded.provider, jobs.provider),
              resolved_media_url=COALESCE(excluded.resolved_media_url, jobs.resolved_media_url),
              evidence_score=excluded.evidence_score,
              needs_review=excluded.needs_review,
              suggestions_json=excluded.suggestions_json,
              updated_at=excluded.updated_at
            """,
            (
                job.id,
                job.status,
                job.progress,
                job.message,
                payload.source_url if payload else None,
                payload.source_kind if payload else None,
                provider,
                resolved_media_url,
                evidence_score,
                needs_review,
                json.dumps(suggestions or [], ensure_ascii=False),
                timestamp,
                timestamp,
            ),
        )


def save_analysis(
    job_id: str,
    payload: VideoLinkAnalysisRequest,
    job: JobStatus,
    generated_skills: list[Skill],
    evidence: list[EvidenceItem],
    operations: list[OperationCandidate],
    *,
    provider: str | None = None,
    resolved_media_url: str | None = None,
    evidence_score: int = 0,
    needs_review: bool = True,
    suggestions: list[str] | None = None,
) -> None:
    save_job(
        job,
        payload,
        provider=provider,
        resolved_media_url=resolved_media_url,
        evidence_score=evidence_score,
        needs_review=needs_review,
        suggestions=suggestions,
    )
    if _using_postgres():
        _save_analysis_postgres(job_id, payload, generated_skills, evidence, operations)
        return

    _save_analysis_sqlite(job_id, payload, generated_skills, evidence, operations)


def _save_analysis_sqlite(
    job_id: str,
    payload: VideoLinkAnalysisRequest,
    generated_skills: list[Skill],
    evidence: list[EvidenceItem],
    operations: list[OperationCandidate],
) -> None:
    timestamp = _now()
    with _LOCK, _connect_sqlite() as db:
        for skill in generated_skills:
            db.execute(
                """
                INSERT INTO skills (id, job_id, source_url, payload_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  job_id=excluded.job_id,
                  source_url=excluded.source_url,
                  payload_json=excluded.payload_json,
                  updated_at=excluded.updated_at
                """,
                (skill.id, job_id, payload.source_url, _to_json(skill), timestamp, timestamp),
            )
        for item in evidence:
            db.execute(
                """
                INSERT OR REPLACE INTO evidence (id, job_id, payload_json, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (item.id, job_id, _to_json(item), timestamp),
            )
        for item in operations:
            db.execute(
                """
                INSERT OR REPLACE INTO operations (id, job_id, payload_json, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (item.id, job_id, _to_json(item), timestamp),
            )


def _save_analysis_postgres(
    job_id: str,
    payload: VideoLinkAnalysisRequest,
    generated_skills: list[Skill],
    evidence: list[EvidenceItem],
    operations: list[OperationCandidate],
) -> None:
    timestamp = _now()
    with _LOCK, _connect_postgres() as db:
        for skill in generated_skills:
            db.execute(
                """
                INSERT INTO skills (id, job_id, source_url, payload_json, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT(id) DO UPDATE SET
                  job_id=excluded.job_id,
                  source_url=excluded.source_url,
                  payload_json=excluded.payload_json,
                  updated_at=excluded.updated_at
                """,
                (skill.id, job_id, payload.source_url, _to_json(skill), timestamp, timestamp),
            )
        for item in evidence:
            db.execute(
                """
                INSERT INTO evidence (id, job_id, payload_json, created_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT(id, job_id) DO UPDATE SET
                  payload_json=excluded.payload_json,
                  created_at=excluded.created_at
                """,
                (item.id, job_id, _to_json(item), timestamp),
            )
        for item in operations:
            db.execute(
                """
                INSERT INTO operations (id, job_id, payload_json, created_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT(id, job_id) DO UPDATE SET
                  payload_json=excluded.payload_json,
                  created_at=excluded.created_at
                """,
                (item.id, job_id, _to_json(item), timestamp),
            )


def get_job(job_id: str) -> JobStatus | None:
    init_store()
    if _using_postgres():
        with _connect_postgres() as db:
            row = db.execute(
                "SELECT id, status, progress, message FROM jobs WHERE id = %s", (job_id,)
            ).fetchone()
    else:
        with _connect_sqlite() as db:
            row = db.execute("SELECT id, status, progress, message FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not row:
        return None
    return JobStatus(id=row["id"], status=row["status"], progress=row["progress"], message=row["message"])


def get_evidence(job_id: str) -> list[EvidenceItem]:
    init_store()
    if _using_postgres():
        with _connect_postgres() as db:
            rows = db.execute(
                "SELECT payload_json FROM evidence WHERE job_id = %s ORDER BY created_at", (job_id,)
            ).fetchall()
    else:
        with _connect_sqlite() as db:
            rows = db.execute("SELECT payload_json FROM evidence WHERE job_id = ? ORDER BY created_at", (job_id,)).fetchall()
    return [_from_json(EvidenceItem, row["payload_json"]) for row in rows]


def get_operations(job_id: str) -> list[OperationCandidate]:
    init_store()
    if _using_postgres():
        with _connect_postgres() as db:
            rows = db.execute(
                "SELECT payload_json FROM operations WHERE job_id = %s ORDER BY created_at", (job_id,)
            ).fetchall()
    else:
        with _connect_sqlite() as db:
            rows = db.execute("SELECT payload_json FROM operations WHERE job_id = ? ORDER BY created_at", (job_id,)).fetchall()
    return [_from_json(OperationCandidate, row["payload_json"]) for row in rows]


def list_skills() -> list[Skill]:
    init_store()
    if _using_postgres():
        with _connect_postgres() as db:
            rows = db.execute("SELECT payload_json FROM skills ORDER BY updated_at DESC").fetchall()
    else:
        with _connect_sqlite() as db:
            rows = db.execute("SELECT payload_json FROM skills ORDER BY updated_at DESC").fetchall()
    return [_from_json(Skill, row["payload_json"]) for row in rows]


def get_skill(skill_id: str) -> Skill | None:
    init_store()
    if _using_postgres():
        with _connect_postgres() as db:
            row = db.execute("SELECT payload_json FROM skills WHERE id = %s", (skill_id,)).fetchone()
    else:
        with _connect_sqlite() as db:
            row = db.execute("SELECT payload_json FROM skills WHERE id = ?", (skill_id,)).fetchone()
    return _from_json(Skill, row["payload_json"]) if row else None


def update_skill(skill_id: str, skill: Skill) -> Skill:
    init_store()
    timestamp = _now()
    if _using_postgres():
        with _LOCK, _connect_postgres() as db:
            db.execute(
                """
                UPDATE skills
                SET payload_json = %s, updated_at = %s
                WHERE id = %s
                """,
                (_to_json(skill), timestamp, skill_id),
            )
    else:
        with _LOCK, _connect_sqlite() as db:
            db.execute(
                """
                UPDATE skills
                SET payload_json = ?, updated_at = ?
                WHERE id = ?
                """,
                (_to_json(skill), timestamp, skill_id),
            )
    return skill


def delete_skill(skill_id: str) -> bool:
    init_store()
    if _using_postgres():
        with _LOCK, _connect_postgres() as db:
            cursor = db.execute("DELETE FROM skills WHERE id = %s", (skill_id,))
            return cursor.rowcount > 0

    with _LOCK, _connect_sqlite() as db:
        cursor = db.execute("DELETE FROM skills WHERE id = ?", (skill_id,))
        return cursor.rowcount > 0


def get_user(email: str) -> dict[str, str] | None:
    init_store()
    normalized_email = email.strip().lower()
    if _using_postgres():
        with _connect_postgres() as db:
            row = db.execute(
                """
                SELECT email, name, password_hash, password_salt
                FROM users
                WHERE email = %s
                """,
                (normalized_email,),
            ).fetchone()
    else:
        with _connect_sqlite() as db:
            row = db.execute(
                """
                SELECT email, name, password_hash, password_salt
                FROM users
                WHERE email = ?
                """,
                (normalized_email,),
            ).fetchone()
    return dict(row) if row else None


def create_user(email: str, name: str, password_hash: str, password_salt: str) -> dict[str, str]:
    init_store()
    normalized_email = email.strip().lower()
    timestamp = _now()

    if _using_postgres():
        with _LOCK, _connect_postgres() as db:
            db.execute(
                """
                INSERT INTO users (email, name, password_hash, password_salt, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (normalized_email, name, password_hash, password_salt, timestamp, timestamp),
            )
    else:
        with _LOCK, _connect_sqlite() as db:
            db.execute(
                """
                INSERT INTO users (email, name, password_hash, password_salt, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (normalized_email, name, password_hash, password_salt, timestamp, timestamp),
            )

    user = get_user(normalized_email)
    if not user:
        raise RuntimeError("User creation did not persist.")
    return user


def store_stats() -> dict[str, object]:
    init_store()
    if _using_postgres():
        with _connect_postgres() as db:
            job_count = db.execute("SELECT COUNT(*) AS count FROM jobs").fetchone()["count"]
            skill_count = db.execute("SELECT COUNT(*) AS count FROM skills").fetchone()["count"]
            evidence_count = db.execute("SELECT COUNT(*) AS count FROM evidence").fetchone()["count"]
        return {
            "status": "ok",
            "database_kind": "postgres",
            "database": _safe_database_label(),
            "jobs": job_count,
            "skills": skill_count,
            "evidence": evidence_count,
        }

    with _connect_sqlite() as db:
        job_count = db.execute("SELECT COUNT(*) AS count FROM jobs").fetchone()["count"]
        skill_count = db.execute("SELECT COUNT(*) AS count FROM skills").fetchone()["count"]
        evidence_count = db.execute("SELECT COUNT(*) AS count FROM evidence").fetchone()["count"]
    return {
        "status": "ok",
        "database_kind": "sqlite",
        "database": str(DB_PATH),
        "jobs": job_count,
        "skills": skill_count,
        "evidence": evidence_count,
    }
