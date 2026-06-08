from pydantic import BaseModel, Field


class JobStatus(BaseModel):
    id: str
    status: str
    progress: int = Field(ge=0, le=100)
    message: str


class EvidenceItem(BaseModel):
    id: str
    job_id: str | None = None
    type: str
    source: str
    text: str
    timestamp: float | None = None
    confidence: float = Field(default=0.5, ge=0, le=1)
    weight: int = Field(default=1, ge=1, le=5)


class OperationCandidate(BaseModel):
    id: str
    operation: str
    label: str
    software: str = "通用技能"
    category: str
    matched_keywords: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    timestamps: list[float] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0, le=1)
    quality: int = Field(default=50, ge=0, le=100)


class Skill(BaseModel):
    id: str
    software: str
    skill_name: str
    level: str
    tags: list[str]
    description: str
    steps: list[str]
    shortcut: list[str]
    timestamp: str
    start: float = 0
    end: float = 0
    confidence: float = Field(ge=0, le=1)
    quality: int = Field(ge=0, le=100)
    evidenceCount: int = 1
    evidenceIds: list[str] = Field(default_factory=list)
    operationId: str | None = None


class VideoLinkAnalysisRequest(BaseModel):
    source_url: str
    embed_url: str | None = None
    source_kind: str = "direct"
    evidence_text: str | None = None
    transcript_text: str | None = None
    ocr_text: str | None = None
    visual_notes: str | None = None
    user_note: str | None = None
    software: str = "通用技能"
    target_level: str = "Intermediate"


class VideoLinkAnalysisResponse(BaseModel):
    job_id: str
    status: str
    message: str
    skills: list[Skill] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    operations: list[OperationCandidate] = Field(default_factory=list)
    evidence_score: int = Field(default=0, ge=0, le=100)
    needs_review: bool = True
    suggestions: list[str] = Field(default_factory=list)
    resolved_media_url: str | None = None
    provider: str | None = None


class AuthEmailCodeRequest(BaseModel):
    email: str


class AuthEmailCodeResponse(BaseModel):
    ok: bool = True
    code: str | None = None
    cooldown_seconds: int = 60
    message: str


class AuthRegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    email_code: str
    captcha: str | None = None


class AuthLoginRequest(BaseModel):
    email: str
    password: str


class AuthUser(BaseModel):
    name: str
    email: str


class AuthResponse(BaseModel):
    token: str
    user: AuthUser
