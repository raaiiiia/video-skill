from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from hashlib import sha1
from typing import Any

from ..models import EvidenceItem, OperationCandidate, Skill, VideoLinkAnalysisRequest
from .gemini_client import GeminiClient, GeminiClientError, is_configured as gemini_is_configured


@dataclass(frozen=True)
class AgentTraceStep:
    action: str
    observation: str
    rationale: str


@dataclass(frozen=True)
class ReactAgentResult:
    summary: str
    skills: list[Skill]
    evidence_score: int
    needs_review: bool
    suggestions: list[str]
    trace: list[AgentTraceStep] = field(default_factory=list)


PLAN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "next_action": {
            "type": "string",
            "enum": ["rank_operations", "draft_skills", "suggest_gaps", "finish"],
        },
        "rationale": {"type": "string"},
        "focus": {"type": "string"},
    },
    "required": ["next_action", "rationale"],
}


FINAL_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "evidence_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "needs_review": {"type": "boolean"},
        "suggestions": {
            "type": "array",
            "items": {"type": "string"},
        },
        "skills": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "software": {"type": "string"},
                    "skill_name": {"type": "string"},
                    "level": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "description": {"type": "string"},
                    "steps": {"type": "array", "items": {"type": "string"}},
                    "shortcut": {"type": "array", "items": {"type": "string"}},
                    "confidence": {"type": "number"},
                    "quality": {"type": "integer"},
                    "operationId": {"type": ["string", "null"]},
                    "evidenceIds": {"type": "array", "items": {"type": "string"}},
                },
                "required": [
                    "software",
                    "skill_name",
                    "level",
                    "tags",
                    "description",
                    "steps",
                    "shortcut",
                    "confidence",
                    "quality",
                    "evidenceIds",
                ],
            },
        },
    },
    "required": ["summary", "evidence_score", "needs_review", "suggestions", "skills"],
}


def run_skill_react_agent(
    payload: VideoLinkAnalysisRequest,
    evidence: list[EvidenceItem],
    operations: list[OperationCandidate],
    *,
    resolved_media_url: str | None = None,
    provider: str | None = None,
) -> ReactAgentResult:
    local_ranked = _rank_operations(operations)
    local_draft = _draft_skills(payload, local_ranked, evidence)
    base_score = _score_evidence(evidence, local_ranked)
    base_suggestions = _build_suggestions(payload, evidence, local_ranked, resolved_media_url, provider)

    if not gemini_is_configured():
        summary = _summarize_locally(payload, local_ranked, evidence)
        return ReactAgentResult(
            summary=summary,
            skills=local_draft,
            evidence_score=base_score,
            needs_review=base_score < 70 or not local_draft,
            suggestions=base_suggestions,
            trace=[],
        )

    client = GeminiClient()
    trace: list[AgentTraceStep] = []
    try:
        plan = client.generate_json(
            prompt=_plan_prompt(payload, evidence, local_ranked, resolved_media_url, provider),
            system_instruction=_system_prompt(),
            schema=PLAN_SCHEMA,
            temperature=0.2,
            max_output_tokens=512,
        )
        action = str(plan.get("next_action", "rank_operations"))
        observation = _execute_tool(action, payload, evidence, local_ranked, resolved_media_url, provider)
        trace.append(
            AgentTraceStep(
                action=action,
                observation=observation,
                rationale=str(plan.get("rationale", "")),
            )
        )
        final = client.generate_json(
            prompt=_final_prompt(payload, evidence, local_ranked, observation, resolved_media_url, provider),
            system_instruction=_system_prompt(),
            schema=FINAL_SCHEMA,
            temperature=0.2,
            max_output_tokens=2048,
        )
        skills = _materialize_skills(
            final.get("skills", []),
            payload=payload,
            evidence=evidence,
            ranked_operations=local_ranked,
        )
        summary = str(final.get("summary") or _summarize_locally(payload, local_ranked, evidence))
        score = int(final.get("evidence_score") or base_score)
        needs_review = bool(final.get("needs_review", score < 70 or not skills))
        suggestions = _merge_suggestions(
            [str(item) for item in final.get("suggestions", []) if str(item).strip()],
            base_suggestions,
        )
        return ReactAgentResult(
            summary=summary,
            skills=skills or local_draft,
            evidence_score=max(0, min(100, score)),
            needs_review=needs_review or not skills,
            suggestions=suggestions,
            trace=trace,
        )
    except (GeminiClientError, ValueError, TypeError, json.JSONDecodeError):
        summary = _summarize_locally(payload, local_ranked, evidence)
        return ReactAgentResult(
            summary=summary,
            skills=local_draft,
            evidence_score=base_score,
            needs_review=True,
            suggestions=base_suggestions,
            trace=trace,
        )


def _system_prompt() -> str:
    return (
        "You are a ReAct skill analyst for Photoshop and creative software tutorials. "
        "Use the provided evidence and the local tool observation to produce concise JSON only. "
        "Do not expose hidden reasoning. Focus on real, reusable skills with steps, tags, and operation links."
    )


def _plan_prompt(
    payload: VideoLinkAnalysisRequest,
    evidence: list[EvidenceItem],
    operations: list[OperationCandidate],
    resolved_media_url: str | None,
    provider: str | None,
) -> str:
    return json.dumps(
        {
            "task": "Choose the best next action for a ReAct skill-generation agent.",
            "source_url": payload.source_url,
            "software": payload.software,
            "target_level": payload.target_level,
            "source_kind": payload.source_kind,
            "resolved_media_url": resolved_media_url,
            "provider": provider,
            "evidence": [_evidence_snapshot(item) for item in evidence],
            "operations": [_operation_snapshot(item) for item in operations],
            "instructions": [
                "Pick rank_operations when the candidate operations are noisy or need prioritization.",
                "Pick draft_skills when evidence is already strong enough for synthesis.",
                "Pick suggest_gaps when the evidence is too thin and more inputs are needed.",
                "Pick finish only when you can directly summarize with no extra tool work.",
            ],
        },
        ensure_ascii=False,
        indent=2,
    )


def _final_prompt(
    payload: VideoLinkAnalysisRequest,
    evidence: list[EvidenceItem],
    operations: list[OperationCandidate],
    observation: str,
    resolved_media_url: str | None,
    provider: str | None,
) -> str:
    return json.dumps(
        {
            "task": "Synthesize final skill JSON from the evidence, ranked operations, and tool observation.",
            "source_url": payload.source_url,
            "software": payload.software,
            "target_level": payload.target_level,
            "source_kind": payload.source_kind,
            "resolved_media_url": resolved_media_url,
            "provider": provider,
            "evidence": [_evidence_snapshot(item) for item in evidence],
            "operations": [_operation_snapshot(item) for item in operations],
            "tool_observation": observation,
            "requirements": [
                "Return practical, reusable Photoshop-style skill steps.",
                "Use only facts supported by the evidence.",
                "Keep the summary short and specific.",
                "If confidence is low, set needs_review true and provide concrete missing inputs.",
            ],
        },
        ensure_ascii=False,
        indent=2,
    )


def _execute_tool(
    action: str,
    payload: VideoLinkAnalysisRequest,
    evidence: list[EvidenceItem],
    operations: list[OperationCandidate],
    resolved_media_url: str | None,
    provider: str | None,
) -> str:
    if action == "suggest_gaps":
        return json.dumps(
            _build_suggestions(payload, evidence, operations, resolved_media_url, provider),
            ensure_ascii=False,
            indent=2,
        )
    if action == "draft_skills":
        return json.dumps(
            [_skill_snapshot(skill) for skill in _draft_skills(payload, operations, evidence)],
            ensure_ascii=False,
            indent=2,
        )
    if action == "finish":
        return _summarize_locally(payload, operations, evidence)
    return json.dumps(
        {
            "ranked_operations": [_operation_snapshot(item) for item in _rank_operations(operations)],
            "evidence_score": _score_evidence(evidence, operations),
        },
        ensure_ascii=False,
        indent=2,
    )


def _rank_operations(operations: list[OperationCandidate]) -> list[OperationCandidate]:
    return sorted(operations, key=lambda item: (item.quality, item.confidence, len(item.evidence_ids)), reverse=True)


def _draft_skills(
    payload: VideoLinkAnalysisRequest,
    operations: list[OperationCandidate],
    evidence: list[EvidenceItem],
) -> list[Skill]:
    ranked = _rank_operations(operations) or [_fallback_operation(payload, evidence)]
    source_timestamp = _first_timestamp(evidence) or _now_iso()
    evidence_ids = [item.id for item in evidence]
    skills: list[Skill] = []

    for index, operation in enumerate(ranked[:3]):
        related_evidence = _related_evidence_ids(operation, evidence)
        support_ids = related_evidence or evidence_ids
        start, end = _time_window(evidence, support_ids)
        skill = Skill(
            id=_stable_id(payload.source_url, operation.operation, operation.label, index),
            software=operation.software or payload.software,
            skill_name=_skill_name(operation),
            level=payload.target_level,
            tags=_skill_tags(operation, payload),
            description=_skill_description(operation, evidence),
            steps=_skill_steps(operation),
            shortcut=operation.label and _shortcut_from_operation(operation) or [],
            timestamp=source_timestamp,
            start=start,
            end=end,
            confidence=max(0.1, min(1.0, operation.confidence)),
            quality=max(0, min(100, operation.quality)),
            evidenceCount=max(1, len(support_ids)),
            evidenceIds=support_ids,
            operationId=operation.id,
        )
        skills.append(skill)

    return skills


def _materialize_skills(
    items: list[dict[str, Any]],
    *,
    payload: VideoLinkAnalysisRequest,
    evidence: list[EvidenceItem],
    ranked_operations: list[OperationCandidate],
) -> list[Skill]:
    if not items:
        return []

    support_evidence = [item.id for item in evidence]
    op_lookup = {item.id: item for item in ranked_operations}
    source_timestamp = _first_timestamp(evidence) or _now_iso()
    result: list[Skill] = []
    for index, raw in enumerate(items):
        operation_id = raw.get("operationId")
        operation = op_lookup.get(operation_id) or (ranked_operations[0] if ranked_operations else None)
        skill = Skill(
            id=_stable_id(payload.source_url, str(raw.get("skill_name", "")), index),
            software=str(raw.get("software") or payload.software),
            skill_name=str(raw.get("skill_name") or (operation.label if operation else "Generated Skill")),
            level=str(raw.get("level") or payload.target_level),
            tags=[str(item) for item in raw.get("tags", []) if str(item).strip()],
            description=str(raw.get("description") or (operation.label if operation else "Generated from evidence")),
            steps=[str(item) for item in raw.get("steps", []) if str(item).strip()],
            shortcut=[str(item) for item in raw.get("shortcut", []) if str(item).strip()],
            timestamp=source_timestamp,
            start=_time_window(evidence, support_evidence)[0],
            end=_time_window(evidence, support_evidence)[1],
            confidence=max(0.1, min(1.0, float(raw.get("confidence", operation.confidence if operation else 0.6)))),
            quality=max(0, min(100, int(raw.get("quality", operation.quality if operation else 60)))),
            evidenceCount=max(1, len(raw.get("evidenceIds", [])) or len(support_evidence)),
            evidenceIds=[str(item) for item in raw.get("evidenceIds", support_evidence) if str(item).strip()],
            operationId=str(operation.id if operation else operation_id) if (operation or operation_id) else None,
        )
        result.append(skill)
    return result


def _build_suggestions(
    payload: VideoLinkAnalysisRequest,
    evidence: list[EvidenceItem],
    operations: list[OperationCandidate],
    resolved_media_url: str | None,
    provider: str | None,
) -> list[str]:
    suggestions: list[str] = []
    if provider and not resolved_media_url:
        suggestions.append(f"{provider} resolved metadata is available, but no direct media URL was recovered.")
    if payload.source_kind == "direct" and not resolved_media_url:
        suggestions.append("If this is a video page, provide a playable media URL or enable iiiLab resolution.")
    if not any(item.type in {"transcript", "ocr"} for item in evidence):
        suggestions.append("Add transcript or OCR text so the agent can confirm the exact menu names and step order.")
    if not any(item.type == "visual" for item in evidence):
        suggestions.append("Add visual notes or frame descriptions to anchor the final skill to visible UI changes.")
    if not operations or operations[0].quality < 55:
        suggestions.append("Provide a clearer tool/action keyword, such as mask, curves, liquify, object selection, or heal.")
    if len(evidence) < 3:
        suggestions.append("Add at least three evidence slices so the agent can separate the main operation from incidental UI noise.")
    return suggestions[:5]


def _score_evidence(evidence: list[EvidenceItem], operations: list[OperationCandidate]) -> int:
    evidence_score = min(55, len(evidence) * 12)
    operation_score = int(sum(item.quality for item in operations[:3]) / max(1, len(operations[:3])) * 0.35) if operations else 0
    confidence_bonus = int(sum(item.confidence for item in evidence) * 8)
    timestamp_bonus = 4 if any(item.timestamp is not None for item in evidence) else 0
    return max(0, min(100, evidence_score + operation_score + confidence_bonus + timestamp_bonus))


def _summarize_locally(
    payload: VideoLinkAnalysisRequest,
    operations: list[OperationCandidate],
    evidence: list[EvidenceItem],
) -> str:
    if operations:
        top = operations[0]
        return f"Detected {top.label} from {len(evidence)} evidence item(s) for {payload.software}."
    return f"Collected {len(evidence)} evidence item(s) for {payload.software}, but no strong operation match was found."


def _skill_name(operation: OperationCandidate) -> str:
    return operation.label or operation.operation.replace("_", " ").title()


def _skill_tags(operation: OperationCandidate, payload: VideoLinkAnalysisRequest) -> list[str]:
    tags = {payload.software, operation.category, operation.label}
    tags.update(operation.matched_keywords[:4])
    return [tag for tag in tags if tag]


def _skill_description(operation: OperationCandidate, evidence: list[EvidenceItem]) -> str:
    if evidence:
        lead = evidence[0].text.strip()
        return f"{operation.label}: {lead[:160]}"
    return operation.label


def _skill_steps(operation: OperationCandidate) -> list[str]:
    steps = [step.strip() for step in operation.label.split() if step.strip()]
    if len(steps) > 1:
        return steps[:5]
    return [
        f"Open the relevant {operation.software} project or frame.",
        f"Apply the {operation.label} workflow.",
        "Review the result and fine-tune the edges, color, or blending.",
    ]


def _shortcut_from_operation(operation: OperationCandidate) -> list[str]:
    if operation.category in {"selection", "compositing"}:
        return ["W", "Q"]
    if operation.category == "retouching":
        return ["J", "B"]
    if operation.category == "color":
        return ["Ctrl+M", "Ctrl+U"]
    return []


def _fallback_operation(payload: VideoLinkAnalysisRequest, evidence: list[EvidenceItem]) -> OperationCandidate:
    keyword = _best_keyword(evidence) or "video_skill_review"
    return OperationCandidate(
        id=_stable_id(payload.source_url, keyword),
        operation=keyword,
        label="Video skill review",
        software=payload.software,
        category="review",
        matched_keywords=[],
        evidence_ids=[item.id for item in evidence],
        timestamps=[item.timestamp for item in evidence if item.timestamp is not None],
        confidence=0.35,
        quality=45,
    )


def _best_keyword(evidence: list[EvidenceItem]) -> str:
    text = " ".join(item.text for item in evidence).lower()
    for keyword in ("mask", "curves", "liquify", "selection", "heal", "replace sky", "object selection", "clone"):
        if keyword in text:
            return keyword.replace(" ", "_")
    return "video_skill_review"


def _related_evidence_ids(operation: OperationCandidate, evidence: list[EvidenceItem]) -> list[str]:
    if operation.evidence_ids:
        return operation.evidence_ids
    matched: list[str] = []
    keywords = [term.lower() for term in operation.matched_keywords + [operation.label, operation.operation]]
    for item in evidence:
        haystack = item.text.lower()
        if any(term and term in haystack for term in keywords):
            matched.append(item.id)
    return matched


def _time_window(evidence: list[EvidenceItem], evidence_ids: list[str]) -> tuple[float, float]:
    timestamps = [item.timestamp for item in evidence if item.id in evidence_ids and item.timestamp is not None]
    if not timestamps:
        timestamps = [item.timestamp for item in evidence if item.timestamp is not None]
    timestamps = [value for value in timestamps if value is not None]
    if not timestamps:
        return 0.0, 0.0
    return float(min(timestamps)), float(max(timestamps))


def _first_timestamp(evidence: list[EvidenceItem]) -> str | None:
    timestamps = [item.timestamp for item in evidence if item.timestamp is not None]
    if not timestamps:
        return None
    return datetime.fromtimestamp(min(timestamps), tz=UTC).isoformat()


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _stable_id(*parts: Any) -> str:
    joined = "|".join(str(part) for part in parts if part is not None)
    return sha1(joined.encode("utf-8")).hexdigest()[:16]


def _evidence_snapshot(item: EvidenceItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "type": item.type,
        "source": item.source,
        "text": item.text[:240],
        "timestamp": item.timestamp,
        "confidence": item.confidence,
        "weight": item.weight,
    }


def _operation_snapshot(item: OperationCandidate) -> dict[str, Any]:
    return {
        "id": item.id,
        "operation": item.operation,
        "label": item.label,
        "category": item.category,
        "matched_keywords": item.matched_keywords,
        "evidence_ids": item.evidence_ids,
        "confidence": item.confidence,
        "quality": item.quality,
    }


def _skill_snapshot(skill: Skill) -> dict[str, Any]:
    return {
        "software": skill.software,
        "skill_name": skill.skill_name,
        "level": skill.level,
        "tags": skill.tags,
        "description": skill.description,
        "steps": skill.steps,
        "shortcut": skill.shortcut,
        "confidence": skill.confidence,
        "quality": skill.quality,
        "operationId": skill.operationId,
        "evidenceIds": skill.evidenceIds,
    }


def _merge_suggestions(primary: list[str], fallback: list[str]) -> list[str]:
    seen: set[str] = set()
    merged: list[str] = []
    for item in primary + fallback:
        normalized = item.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            merged.append(normalized)
    return merged[:5]
