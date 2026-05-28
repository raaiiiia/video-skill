import asyncio
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect

from .models import JobStatus, Skill, VideoLinkAnalysisRequest, VideoLinkAnalysisResponse
from .services.skill_generator import analyze_link_without_download

router = APIRouter()
jobs: dict[str, JobStatus] = {}
skills: list[Skill] = []


@router.post("/videos/upload")
async def upload_video(files: list[UploadFile] = File(...)):
    job_id = f"job_{uuid4().hex[:10]}"
    jobs[job_id] = JobStatus(
        id=job_id,
        status="queued",
        progress=0,
        message=f"{len(files)} files accepted",
    )
    return {"job_id": job_id, "files": [file.filename for file in files]}


@router.post("/videos/analyze-link", response_model=VideoLinkAnalysisResponse)
async def analyze_video_link(payload: VideoLinkAnalysisRequest):
    job_id = f"job_{uuid4().hex[:10]}"
    result = analyze_link_without_download(payload)
    jobs[job_id] = JobStatus(
        id=job_id,
        status=result.status,
        progress=0,
        message=result.message,
    )
    if result.skills:
        skills.extend(result.skills)
    return VideoLinkAnalysisResponse(
        job_id=job_id,
        status=result.status,
        message=result.message,
        skills=result.skills,
    )


@router.get("/jobs/{job_id}", response_model=JobStatus)
def get_job(job_id: str):
    return jobs.get(job_id, JobStatus(id=job_id, status="missing", progress=0, message="Job not found"))


@router.websocket("/ws/jobs/{job_id}")
async def job_updates(websocket: WebSocket, job_id: str):
    await websocket.accept()
    status = jobs.get(job_id)
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
    return skills


@router.post("/skills/generate", response_model=Skill)
def generate_skill():
    raise HTTPException(status_code=501, detail="Skill generation needs real video evidence and is not mocked.")


@router.get("/search")
def search(q: str):
    results = []
    for skill in skills:
        haystack = " ".join([skill.skill_name, skill.description, *skill.tags, *skill.shortcut])
        if q.lower() in haystack.lower():
            results.append({"skill": skill, "score": 0.92})
    return {"query": q, "results": results}
