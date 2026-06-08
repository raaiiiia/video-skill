from __future__ import annotations

import asyncio
import re
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect

from .auth import current_user, router as auth_router
from .models import AuthUser, EvidenceItem, JobStatus, OperationCandidate, Skill, VideoLinkAnalysisRequest, VideoLinkAnalysisResponse
from .services.gemini_client import GeminiClient, GeminiClientError, is_configured as gemini_is_configured
from .services.skill_generator import OPERATION_RULES, analyze_link_without_download
from .store import (
    delete_skill as delete_stored_skill,
    get_evidence as get_stored_evidence,
    get_job as get_stored_job,
    get_operations as get_stored_operations,
    get_skill as get_stored_skill,
    list_skills as list_stored_skills,
    save_analysis,
    store_stats,
    update_skill as update_stored_skill,
)

router = APIRouter()
router.include_router(auth_router, prefix="/auth", tags=["auth"])


def _job_status(job_id: str, result: VideoLinkAnalysisResponse) -> JobStatus:
    return JobStatus(
        id=job_id,
        status=result.status,
        progress=100 if result.skills else min(65, result.evidence_score),
        message=result.message,
    )


def _attach_job_id(job_id: str, evidence: list[EvidenceItem]) -> list[EvidenceItem]:
    return [item.model_copy(update={"job_id": job_id}) for item in evidence]


def _is_image_upload(upload: UploadFile) -> bool:
    content_type = (upload.content_type or "").lower()
    if content_type.startswith("image/"):
        return True
    suffix = Path(upload.filename or "").suffix.lower()
    return suffix in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".heic", ".heif"}


def _build_upload_payload(
    *,
    file: UploadFile,
    source_url: str | None,
    embed_url: str | None,
    evidence_text: str | None,
    transcript_text: str | None,
    ocr_text: str | None,
    visual_notes: str | None,
    user_note: str | None,
    software: str,
    target_level: str,
    extra_note: str | None = None,
) -> VideoLinkAnalysisRequest:
    file_name = file.filename or "uploaded-media"
    source = source_url or file_name
    combined_note = "\n".join(
        value.strip()
        for value in [
            extra_note,
            f"Uploaded file: {file_name}",
            f"Content type: {file.content_type}" if file.content_type else None,
            user_note,
        ]
        if value and value.strip()
    )
    combined_evidence = "\n".join(
        value.strip()
        for value in [evidence_text, combined_note]
        if value and value.strip()
    ) or None

    return VideoLinkAnalysisRequest(
        source_url=source,
        embed_url=embed_url,
        source_kind="file",
        evidence_text=combined_evidence,
        transcript_text=transcript_text,
        ocr_text=ocr_text,
        visual_notes=visual_notes,
        user_note=combined_note or user_note,
        software=software,
        target_level=target_level,
    )


@router.post("/videos/upload", response_model=VideoLinkAnalysisResponse)
async def upload_video(
    _user: Annotated[AuthUser, Depends(current_user)],
    file: UploadFile = File(...),
    source_url: str | None = Form(None),
    embed_url: str | None = Form(None),
    evidence_text: str | None = Form(None),
    transcript_text: str | None = Form(None),
    ocr_text: str | None = Form(None),
    visual_notes: str | None = Form(None),
    user_note: str | None = Form(None),
    software: str = Form("通用技能"),
    target_level: str = Form("Intermediate"),
):
    job_id = f"job_{uuid4().hex[:10]}"
    extra_note: str | None = None

    if _is_image_upload(file) and gemini_is_configured():
        try:
            client = GeminiClient()
            image_analysis = client.generate_json_with_image(
                await file.read(),
                mime_type=file.content_type,
                prompt=(
                    "You are extracting evidence from a user-uploaded image for Photoshop skill generation. "
                    "Return JSON with keys: ocr_text, visual_notes, evidence_text, summary. "
                    "ocr_text should contain visible text; visual_notes should describe the UI or image changes; "
                    "evidence_text should capture concrete actions or cues that support a skill instruction."
                ),
                schema={
                    "type": "object",
                    "properties": {
                        "ocr_text": {"type": "string"},
                        "visual_notes": {"type": "string"},
                        "evidence_text": {"type": "string"},
                        "summary": {"type": "string"},
                    },
                    "required": ["ocr_text", "visual_notes", "evidence_text", "summary"],
                },
            )
            ocr_text = "\n".join(value for value in [ocr_text, image_analysis.get("ocr_text")] if value)
            visual_notes = "\n".join(value for value in [visual_notes, image_analysis.get("visual_notes")] if value)
            evidence_text = "\n".join(value for value in [evidence_text, image_analysis.get("evidence_text")] if value)
            extra_note = image_analysis.get("summary") or None
        except GeminiClientError as exc:
            extra_note = str(exc)
    else:
        await file.read()

    payload = _build_upload_payload(
        file=file,
        source_url=source_url,
        embed_url=embed_url,
        evidence_text=evidence_text,
        transcript_text=transcript_text,
        ocr_text=ocr_text,
        visual_notes=visual_notes,
        user_note=user_note,
        software=software,
        target_level=target_level,
        extra_note=extra_note,
    )

    result = analyze_link_without_download(payload)
    evidence = _attach_job_id(job_id, result.evidence)
    save_analysis(
        job_id=job_id,
        payload=payload,
        job=_job_status(job_id, result),
        generated_skills=result.skills,
        evidence=evidence,
        operations=result.operations,
        provider=result.provider,
        resolved_media_url=result.resolved_media_url,
        evidence_score=result.evidence_score,
        needs_review=result.needs_review,
        suggestions=result.suggestions,
    )
    return VideoLinkAnalysisResponse(
        job_id=job_id,
        status=result.status,
        message=result.message,
        skills=result.skills,
        evidence=evidence,
        operations=result.operations,
        evidence_score=result.evidence_score,
        needs_review=result.needs_review,
        suggestions=result.suggestions,
        resolved_media_url=result.resolved_media_url,
        provider=result.provider,
    )


@router.post("/videos/analyze-link", response_model=VideoLinkAnalysisResponse)
async def analyze_video_link(
    payload: VideoLinkAnalysisRequest,
    _user: Annotated[AuthUser, Depends(current_user)],
):
    job_id = f"job_{uuid4().hex[:10]}"
    result = analyze_link_without_download(payload)
    evidence = _attach_job_id(job_id, result.evidence)
    save_analysis(
        job_id=job_id,
        payload=payload,
        job=_job_status(job_id, result),
        generated_skills=result.skills,
        evidence=evidence,
        operations=result.operations,
        provider=result.provider,
        resolved_media_url=result.resolved_media_url,
        evidence_score=result.evidence_score,
        needs_review=result.needs_review,
        suggestions=result.suggestions,
    )
    return VideoLinkAnalysisResponse(
        job_id=job_id,
        status=result.status,
        message=result.message,
        skills=result.skills,
        evidence=evidence,
        operations=result.operations,
        evidence_score=result.evidence_score,
        needs_review=result.needs_review,
        suggestions=result.suggestions,
        resolved_media_url=result.resolved_media_url,
        provider=result.provider,
    )


@router.get("/jobs/{job_id}", response_model=JobStatus)
def get_job(job_id: str):
    return get_stored_job(job_id) or JobStatus(id=job_id, status="missing", progress=0, message="Job not found")


@router.get("/jobs/{job_id}/evidence", response_model=list[EvidenceItem])
def get_job_evidence(job_id: str):
    return get_stored_evidence(job_id)


@router.get("/jobs/{job_id}/operations", response_model=list[OperationCandidate])
def get_job_operations(job_id: str):
    return get_stored_operations(job_id)


@router.websocket("/ws/jobs/{job_id}")
async def job_updates(websocket: WebSocket, job_id: str):
    await websocket.accept()
    status = get_stored_job(job_id)
    if not status:
        await websocket.send_json(JobStatus(id=job_id, status="missing", progress=0, message="Job not found").model_dump())
        return

    try:
        await websocket.send_json(status.model_dump())
        await asyncio.sleep(0.2)
    except WebSocketDisconnect:
        return


@router.get("/skills", response_model=list[Skill])
def list_skills():
    return list_stored_skills()


@router.put("/skills/{skill_id}", response_model=Skill)
def update_skill(
    skill_id: str,
    skill: Skill,
    _user: Annotated[AuthUser, Depends(current_user)],
):
    if not get_stored_skill(skill_id):
        raise HTTPException(status_code=404, detail="Skill not found")
    next_skill = skill.model_copy(update={"id": skill_id}) if skill.id != skill_id else skill
    return update_stored_skill(skill_id, next_skill)


@router.delete("/skills/{skill_id}")
def delete_skill(
    skill_id: str,
    _user: Annotated[AuthUser, Depends(current_user)],
):
    if not delete_stored_skill(skill_id):
        raise HTTPException(status_code=404, detail="Skill not found")
    return {"ok": True, "skill_id": skill_id}


@router.post("/skills/generate", response_model=Skill)
def generate_skill(
    payload: VideoLinkAnalysisRequest,
    _user: Annotated[AuthUser, Depends(current_user)],
):
    job_id = f"job_{uuid4().hex[:10]}"
    result = analyze_link_without_download(payload)
    evidence = _attach_job_id(job_id, result.evidence)
    save_analysis(
        job_id=job_id,
        payload=payload,
        job=_job_status(job_id, result),
        generated_skills=result.skills,
        evidence=evidence,
        operations=result.operations,
        provider=result.provider,
        resolved_media_url=result.resolved_media_url,
        evidence_score=result.evidence_score,
        needs_review=result.needs_review,
        suggestions=result.suggestions,
    )
    if not result.skills:
        raise HTTPException(status_code=422, detail="No skill could be generated from the provided evidence.")
    return result.skills[0]


SEARCH_SPLIT_PATTERN = re.compile(r"[\s,，、。；;:：|]+")


def _normalize_text(value: str) -> str:
    return value.lower().strip()


def _search_terms(query: str) -> set[str]:
    normalized = _normalize_text(query)
    terms = {term for term in SEARCH_SPLIT_PATTERN.split(normalized) if term}
    if normalized:
        terms.add(normalized)

    for rule in OPERATION_RULES:
        fields = [
            rule.operation,
            rule.label,
            rule.category,
            rule.description,
            *rule.tags,
            *rule.shortcuts,
            *rule.keywords,
            *rule.steps,
        ]
        normalized_fields = {_normalize_text(field) for field in fields if field}
        if any(term in field or field in term for term in terms for field in normalized_fields if term and field):
            terms.update(normalized_fields)
    return {term for term in terms if term}


def _direct_search_terms(query: str) -> set[str]:
    normalized = _normalize_text(query)
    terms = {term for term in SEARCH_SPLIT_PATTERN.split(normalized) if term}
    if normalized:
        terms.add(normalized)
    return {term for term in terms if term}


def _skill_haystack(skill: Skill) -> str:
    return " ".join(
        [
            skill.skill_name,
            skill.software,
            skill.level,
            skill.description,
            *skill.tags,
            *skill.shortcut,
            *skill.steps,
        ]
    ).lower()


def _score_skill(skill: Skill, query: str) -> int:
    haystack = _skill_haystack(skill)
    normalized = _normalize_text(query)
    direct_terms = _direct_search_terms(query)
    expanded_terms = _search_terms(query) - direct_terms
    score = 0

    if normalized and normalized in haystack:
        score += 42

    for term in direct_terms:
        if term and term in haystack:
            score += 18 + min(len(term), 14)

    for term in expanded_terms:
        if term and term in haystack:
            score += 3

    for rule in OPERATION_RULES:
        rule_fields = [rule.operation, rule.label, rule.category, rule.description, *rule.tags, *rule.keywords]
        rule_terms = [_normalize_text(field) for field in rule_fields if field]
        rule_text = " ".join(rule_terms)
        if any(term in rule_text for term in direct_terms):
            if _normalize_text(rule.label) in haystack or rule.operation in haystack:
                score += 28
            elif any(_normalize_text(tag) in haystack for tag in rule.tags):
                score += 12

    if score > 0:
        score += min(6, int(skill.confidence * 6)) + min(6, skill.quality // 16)
    return score


def _response_score(score: int) -> float:
    return round(min(0.99, max(0.1, score / 140)), 2)


@router.get("/search")
def search(q: str = ""):
    query = q.strip()
    results = []
    for skill in list_stored_skills():
        score = 100 + int(skill.confidence * 10) + min(10, skill.quality // 10) if not query else _score_skill(skill, query)
        if query and score <= 0:
            continue
        results.append({"skill": skill, "score": _response_score(score)})

    results.sort(key=lambda item: item["score"], reverse=True)
    return {"query": query, "results": results}


@router.get("/health")
def health():
    return store_stats()
