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
    confidence: float = Field(ge=0, le=1)
    quality: int = Field(ge=0, le=100)
