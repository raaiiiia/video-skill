from dataclasses import dataclass

from ..models import Skill, VideoLinkAnalysisRequest


@dataclass(frozen=True)
class AnalysisResult:
    status: str
    message: str
    skills: list[Skill]


def analyze_link_without_download(payload: VideoLinkAnalysisRequest) -> AnalysisResult:
    """Register the link without downloading media or inventing skills."""
    if payload.source_kind == "webpage":
        return AnalysisResult(
            status="needs_provider_data",
            message=(
                "The webpage video link was recorded. Cross-origin embedded players do not expose frames, "
                "audio, or timeline data to this backend. Provide a real provider API, transcript, or "
                "server-side analyzer before skills can be generated."
            ),
            skills=[],
        )

    return AnalysisResult(
        status="needs_media_access",
        message=(
            "The direct video link was recorded. This backend is configured not to download or store video, "
            "so skill generation requires a transcript, metadata API, or streaming analyzer that returns evidence."
        ),
        skills=[],
    )
