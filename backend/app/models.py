from pydantic import BaseModel, Field


class JobStatus(BaseModel):
    id: str
    status: str
    progress: int = Field(ge=0, le=100)
    message: str


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


class VideoLinkAnalysisRequest(BaseModel):
    source_url: str
    embed_url: str | None = None
    source_kind: str = "direct"


class VideoLinkAnalysisResponse(BaseModel):
    job_id: str
    status: str
    message: str
    skills: list[Skill] = Field(default_factory=list)
