import asyncio
from uuid import uuid4

from fastapi import APIRouter, File, UploadFile, WebSocket, WebSocketDisconnect

from .models import JobStatus, Skill
from .services.skill_generator import demo_skills, generate_skill_from_segments

router = APIRouter()
jobs: dict[str, JobStatus] = {}


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


@router.get("/jobs/{job_id}", response_model=JobStatus)
def get_job(job_id: str):
    return jobs.get(job_id, JobStatus(id=job_id, status="missing", progress=0, message="Job not found"))


@router.websocket("/ws/jobs/{job_id}")
async def job_updates(websocket: WebSocket, job_id: str):
    await websocket.accept()
    stages = [
        ("extracting", 18, "OpenCV keyframe extraction"),
        ("asr", 36, "Whisper transcript alignment"),
        ("ocr", 54, "PaddleOCR UI text extraction"),
        ("vision", 72, "YOLO interface and action detection"),
        ("graph", 90, "Skill clustering and graph update"),
        ("done", 100, "Skill library updated"),
    ]
    try:
        for status, progress, message in stages:
            payload = JobStatus(id=job_id, status=status, progress=progress, message=message)
            jobs[job_id] = payload
            await websocket.send_json(payload.model_dump())
            await asyncio.sleep(0.8)
    except WebSocketDisconnect:
        return


@router.get("/skills", response_model=list[Skill])
def list_skills():
    return demo_skills()


@router.post("/skills/generate", response_model=Skill)
def generate_skill():
    return generate_skill_from_segments()


@router.get("/search")
def search(q: str):
    results = []
    for skill in demo_skills():
        haystack = " ".join([skill.skill_name, skill.description, *skill.tags, *skill.shortcut])
        if q.lower() in haystack.lower() or "高光" in q and "高光" in haystack:
            results.append({"skill": skill, "score": 0.92})
    return {"query": q, "results": results}
