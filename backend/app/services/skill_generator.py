from __future__ import annotations

import re
from dataclasses import dataclass
from hashlib import sha1
from html import unescape
from typing import Any
from urllib.parse import urlparse

import requests

from ..models import EvidenceItem, OperationCandidate, Skill, VideoLinkAnalysisRequest
from .gemini_client import is_configured as gemini_is_configured
from .iiilab_client import IiiLabNotConfigured, IiiLabResolveError, ResolvedVideo, is_configured, resolve_video
from .skill_agent import ReactAgentResult, run_skill_react_agent


@dataclass(frozen=True)
class AnalysisResult:
    status: str
    message: str
    skills: list[Skill]
    evidence: list[EvidenceItem]
    operations: list[OperationCandidate]
    evidence_score: int
    needs_review: bool
    suggestions: list[str]
    resolved_media_url: str | None = None
    provider: str | None = None


@dataclass(frozen=True)
class OperationRule:
    operation: str
    label: str
    category: str
    tags: list[str]
    description: str
    steps: list[str]
    shortcuts: list[str]
    keywords: tuple[str, ...]


@dataclass(frozen=True)
class PublicVideoMetadata:
    provider: str
    title: str | None = None
    description: str | None = None
    canonical_url: str | None = None
    image_url: str | None = None
    site_name: str | None = None
    dynamic: str | None = None
    part: str | None = None
    owner: str | None = None
    duration: int | None = None


OPERATION_RULES: tuple[OperationRule, ...] = (
    OperationRule(
        operation="sky_replacement",
        label="快速抠图换天空",
        category="compositing",
        tags=["抠图", "换天空", "合成", "蒙版", "调色"],
        description="基于天空替换、选主体、图层蒙版和光色统一证据，生成 Photoshop 换天空合成流程。",
        steps=[
            "打开需要替换天空的照片并复制背景图层，保留可回退版本",
            "使用对象选择、快速选择或选择主体建立天空与主体边界",
            "进入选择并遮住，检查头发、树枝、建筑边缘等细节",
            "放入新天空素材或使用天空替换面板匹配天空方向和比例",
            "用图层蒙版控制天空显隐，保留前景主体轮廓",
            "用曲线、色相饱和度或 Camera Raw 统一前景与天空光色",
            "放大检查边缘、云层过渡和整体透视是否自然",
        ],
        shortcuts=["W", "Q", "B", "Ctrl+T", "Ctrl+M"],
        keywords=(
            "换天空",
            "天空替换",
            "抠图",
            "选择主体",
            "快速选择",
            "选择并遮住",
            "蒙版",
            "camera raw",
            "sky replacement",
            "replace sky",
            "select subject",
            "object selection",
        ),
    ),
    OperationRule(
        operation="select_subject",
        label="主体选择与边缘精修",
        category="selection",
        tags=["抠图", "选区", "主体", "边缘"],
        description="从主体选择、对象选择、快速选择和选择并遮住组合中提取可复用的选区精修技能。",
        steps=[
            "判断主体边缘类型，优先使用选择主体或对象选择工具生成初选区",
            "用快速选择补齐缺失区域，并按 Alt 减去错误选区",
            "进入选择并遮住，切换视图检查复杂边缘",
            "用调整边缘画笔处理头发、树枝、半透明边缘",
            "输出为图层蒙版，回到画布继续用画笔微调",
        ],
        shortcuts=["W", "Alt", "Ctrl+D", "Shift+Ctrl+I"],
        keywords=(
            "选择主体",
            "主体选择",
            "对象选择",
            "快速选择",
            "选择并遮住",
            "调整边缘",
            "精修边缘",
            "选区",
            "抠图",
            "select subject",
            "object selection",
            "refine edge",
        ),
    ),
    OperationRule(
        operation="content_aware_fill",
        label="内容识别填充去除物体",
        category="cleanup",
        tags=["修图", "去除", "填充", "内容识别"],
        description="根据去除物体、内容识别填充、取样区域和修复工具证据生成画面清理流程。",
        steps=[
            "用套索或对象选择圈出需要移除的人物、杂物或瑕疵区域",
            "进入内容识别填充或删除并填充，观察预览结果",
            "调整取样区域，排除会污染填充结果的主体和边缘",
            "输出到新图层，保留原图并方便局部修正",
            "用修复画笔、仿制图章或污点修复清理残留纹理",
        ],
        shortcuts=["L", "J", "S", "Shift+F5"],
        keywords=(
            "内容识别填充",
            "内容感知填充",
            "删除并填充",
            "去除物体",
            "移除物体",
            "删除路人",
            "清理画面",
            "修复画笔",
            "content-aware fill",
        ),
    ),
    OperationRule(
        operation="skin_retouch",
        label="人像皮肤质感修饰",
        category="retouching",
        tags=["修图", "人像", "磨皮"],
        description="基于皮肤、瑕疵或频率分离操作，生成非破坏式人像皮肤处理流程。",
        steps=[
            "复制并保护原图层",
            "清理明显瑕疵与痘印",
            "分离或降低皮肤杂色",
            "用蒙版限制修饰范围",
            "回看纹理是否自然、是否过度磨皮",
        ],
        shortcuts=["Ctrl+J", "B"],
        keywords=("磨皮", "皮肤", "肤质", "频率分离", "skin", "frequency separation", "texture"),
    ),
    OperationRule(
        operation="color_grading",
        label="颜色与整体调色",
        category="color",
        tags=["调色", "曲线", "Camera Raw"],
        description="根据曝光、白平衡、曲线、色相或 Camera Raw 证据生成调色技能。",
        steps=[
            "进入 Camera Raw 或调整图层",
            "校正曝光和白平衡",
            "使用曲线控制高光与阴影",
            "统一肤色和背景色彩倾向",
        ],
        shortcuts=["Ctrl+M", "Ctrl+U"],
        keywords=("调色", "色调", "色彩", "曲线", "白平衡", "camera raw", "color", "curves", "hsl"),
    ),
    OperationRule(
        operation="liquify_shape",
        label="脸型与轮廓液化",
        category="shape",
        tags=["液化", "轮廓", "人像"],
        description="从液化、脸型、轮廓或局部推拉证据中提取结构调整流程。",
        steps=[
            "复制保护图层",
            "打开液化工具",
            "降低笔刷压力，缓慢推拉边缘",
            "对比前后差异并避免过度变形",
        ],
        shortcuts=["Ctrl+Shift+X"],
        keywords=("液化", "脸型", "轮廓", "瘦脸", "liquify", "face shape", "warp"),
    ),
    OperationRule(
        operation="mask_compositing",
        label="蒙版与局部合成控制",
        category="compositing",
        tags=["蒙版", "合成", "局部调整"],
        description="根据蒙版、选区、画笔擦除和局部控制证据生成合成与遮罩流程。",
        steps=[
            "建立选区或图层蒙版",
            "使用软边画笔控制显示与隐藏",
            "按区域调节不透明度",
            "检查边缘是否干净自然",
        ],
        shortcuts=["Q", "B", "X"],
        keywords=("蒙版", "选区", "抠图", "合成", "mask", "selection", "layer mask"),
    ),
    OperationRule(
        operation="detail_sharpen",
        label="细节锐化与输出检查",
        category="output",
        tags=["锐化", "输出", "细节"],
        description="从高反差保留、智能锐化或导出前检查证据中提取输出阶段技能。",
        steps=[
            "合并可见图层或建立输出副本",
            "使用高反差保留或智能锐化",
            "用蒙版限制锐化区域",
            "按目标尺寸检查最终清晰度",
        ],
        shortcuts=["Ctrl+Alt+Shift+E"],
        keywords=("锐化", "细节", "高反差", "导出", "sharpen", "high pass", "output"),
    ),
)

GENERIC_OPERATION_RULE = OperationRule(
    operation="video_skill_review",
    label="视频教程技能提取待复核",
    category="review",
    tags=["教程", "待复核", "自动提取"],
    description="根据当前链接、文本和页面信息生成初步 Skill 草案，需要补充字幕、OCR 或画面描述后再细化。",
    steps=[
        "记录视频来源、标题或文件名作为 Skill 追踪入口",
        "识别软件、素材类型和最终效果",
        "补充字幕、OCR 或画面变化描述以提取具体操作顺序",
        "拆分为可复用的 Photoshop 技能并标注时间段",
    ],
    shortcuts=[],
    keywords=(),
)


def analyze_link_without_download(payload: VideoLinkAnalysisRequest) -> AnalysisResult:
    evidence, provider, resolved_media_url, provider_note = collect_evidence(payload)
    operations = detect_operations(evidence, payload.software)

    agent_result = run_skill_react_agent(
        payload,
        evidence,
        operations,
        resolved_media_url=resolved_media_url,
        provider=provider,
    )

    skills = agent_result.skills or generate_skills(
        payload.source_url,
        operations,
        payload.target_level,
        evidence=evidence,
        summary=agent_result.summary,
        software=payload.software,
    )
    evidence_score = max(agent_result.evidence_score, score_evidence(evidence, operations))
    suggestions = build_suggestions(
        payload,
        evidence,
        operations,
        resolved_media_url,
        provider_note,
    )
    if agent_result.suggestions:
        suggestions = _merge_unique(agent_result.suggestions + suggestions)

    needs_review = agent_result.needs_review or evidence_score < 70 or not skills
    message = agent_result.summary or _summarize_result(payload, operations, evidence)

    return _build_result(
        payload=payload,
        message=message,
        skills=skills,
        evidence=evidence,
        operations=operations,
        evidence_score=evidence_score,
        needs_review=needs_review,
        suggestions=suggestions,
        resolved_media_url=resolved_media_url,
        provider=provider,
    )


def collect_evidence(
    payload: VideoLinkAnalysisRequest,
) -> tuple[list[EvidenceItem], str | None, str | None, str | None]:
    evidence: list[EvidenceItem] = []
    provider: str | None = None
    resolved_media_url: str | None = None
    provider_note: str | None = None

    if payload.source_kind == "file":
        provider = "uploaded_file"
    elif payload.source_url.startswith(("http://", "https://")):
        provider = _detect_provider(payload.source_url)

    if payload.source_url:
        evidence.append(_make_evidence("source_url", payload.source_url, payload.source_url, confidence=0.9))

    if payload.embed_url:
        evidence.append(_make_evidence("embed_url", payload.embed_url, payload.source_url, confidence=0.75))

    if payload.evidence_text:
        evidence.append(_make_evidence("evidence_text", payload.evidence_text, payload.source_url, confidence=0.85))

    if payload.transcript_text:
        evidence.append(_make_evidence("transcript", payload.transcript_text, payload.source_url, confidence=0.92))

    if payload.ocr_text:
        evidence.append(_make_evidence("ocr", payload.ocr_text, payload.source_url, confidence=0.9))

    if payload.visual_notes:
        evidence.append(_make_evidence("visual", payload.visual_notes, payload.source_url, confidence=0.7))

    if payload.user_note:
        evidence.append(_make_evidence("note", payload.user_note, payload.source_url, confidence=0.6))

    if payload.source_url.startswith(("http://", "https://")) and is_configured():
        try:
            resolved = resolve_video(payload.source_url)
            if resolved.media_url:
                resolved_media_url = resolved.media_url
                provider = "iiilab"
                if resolved.title:
                    evidence.append(_make_evidence("title", resolved.title, payload.source_url, confidence=0.8))
                if resolved.description:
                    evidence.append(_make_evidence("description", resolved.description, payload.source_url, confidence=0.75))
        except (IiiLabNotConfigured, IiiLabResolveError) as exc:
            provider_note = str(exc)

    public_metadata = fetch_public_video_metadata(payload.source_url)
    if public_metadata:
        provider = provider or public_metadata.provider
        if public_metadata.title:
            evidence.append(_make_evidence("page_title", public_metadata.title, payload.source_url, confidence=0.7))
        if public_metadata.description:
            evidence.append(_make_evidence("page_description", public_metadata.description, payload.source_url, confidence=0.65))
        if public_metadata.site_name:
            evidence.append(_make_evidence("site_name", public_metadata.site_name, payload.source_url, confidence=0.6))
        if public_metadata.canonical_url and public_metadata.canonical_url != payload.source_url:
            evidence.append(_make_evidence("canonical_url", public_metadata.canonical_url, payload.source_url, confidence=0.5))
            provider = provider or _detect_provider(public_metadata.canonical_url)
        if public_metadata.image_url:
            evidence.append(_make_evidence("page_image", public_metadata.image_url, payload.source_url, confidence=0.55))

    return evidence, provider, resolved_media_url, provider_note


def fetch_public_video_metadata(url: str) -> PublicVideoMetadata | None:
    if not url.startswith(("http://", "https://")):
        return None

    provider = _detect_provider(url) or "web"
    try:
        response = requests.get(
            url,
            timeout=8,
            headers={"User-Agent": "Mozilla/5.0"},
            allow_redirects=True,
        )
    except requests.RequestException:
        return None

    if response.status_code >= 400:
        return None

    body = response.text[:200_000]
    final_url = response.url or url
    title = _extract_meta_content(body, property_name="og:title") or _extract_html_title(body)
    description = (
        _extract_meta_content(body, property_name="og:description")
        or _extract_meta_content(body, name="twitter:description")
        or _extract_meta_description(body)
    )
    canonical_url = _extract_link_canonical(body) or final_url
    site_name = _extract_meta_content(body, property_name="og:site_name") or _extract_meta_content(body, name="application-name")
    image_url = _extract_meta_content(body, property_name="og:image") or _extract_meta_content(body, name="twitter:image")
    provider = _detect_provider(canonical_url or final_url or url) or provider
    return PublicVideoMetadata(
        provider=provider,
        title=title,
        description=description,
        canonical_url=canonical_url,
        image_url=image_url,
        site_name=site_name,
    )


def detect_operations(evidence: list[EvidenceItem], software: str) -> list[OperationCandidate]:
    haystack = " ".join(item.text for item in evidence).lower()
    candidates: list[OperationCandidate] = []
    for rule in OPERATION_RULES:
        matched_keywords = _matched_keywords(rule, haystack)
        if not matched_keywords:
            continue
        evidence_ids = [item.id for item in evidence if any(keyword.lower() in item.text.lower() for keyword in matched_keywords)]
        confidence = min(0.95, 0.35 + len(matched_keywords) * 0.1 + len(evidence_ids) * 0.05)
        quality = min(100, 40 + len(matched_keywords) * 8 + len(evidence_ids) * 4)
        candidates.append(
            OperationCandidate(
                id=_stable_id(rule.operation, software, *matched_keywords),
                operation=rule.operation,
                label=rule.label,
                software=software,
                category=rule.category,
                matched_keywords=matched_keywords,
                evidence_ids=evidence_ids,
                timestamps=_timestamps_for_ids(evidence, evidence_ids),
                confidence=confidence,
                quality=quality,
            )
        )

    if not candidates:
        candidates.append(build_generic_operation(evidence, software))

    return sorted(candidates, key=lambda item: (item.quality, item.confidence), reverse=True)


def build_generic_operation(evidence: list[EvidenceItem], software: str) -> OperationCandidate:
    text = " ".join(item.text for item in evidence).lower()
    fallback_keyword = next(
        (keyword for keyword in ("mask", "curve", "liquify", "selection", "heal", "retouch", "remove", "sky") if keyword in text),
        "video_skill_review",
    )
    evidence_ids = [item.id for item in evidence]
    return OperationCandidate(
        id=_stable_id(fallback_keyword, software, *evidence_ids),
        operation=fallback_keyword,
        label=GENERIC_OPERATION_RULE.label,
        software=software,
        category=GENERIC_OPERATION_RULE.category,
        matched_keywords=[fallback_keyword] if fallback_keyword != "video_skill_review" else [],
        evidence_ids=evidence_ids,
        timestamps=[item.timestamp for item in evidence if item.timestamp is not None],
        confidence=0.35,
        quality=45,
    )


def generate_skills(
    source_url: str,
    operations: list[OperationCandidate],
    target_level: str,
    *,
    evidence: list[EvidenceItem] | None = None,
    summary: str | None = None,
    software: str = "通用技能",
) -> list[Skill]:
    evidence = evidence or []
    ranked = operations or [build_generic_operation(evidence, software)]
    source_timestamp = _first_timestamp(evidence) or _now_iso()
    skills: list[Skill] = []
    for index, operation in enumerate(ranked[:3]):
        support_ids = operation.evidence_ids or [item.id for item in evidence]
        start, end = _time_window(evidence, support_ids)
        steps = list(operation_steps(operation))
        if summary and steps:
            steps[-1] = f"Review the result against the agent summary: {summary[:120]}"
        skills.append(
            Skill(
                id=_stable_id(source_url, operation.operation, operation.label, index),
                software=operation.software or software,
                skill_name=operation.label,
                level=target_level,
                tags=_skill_tags(operation, software),
                description=_skill_description(operation, evidence, summary),
                steps=steps,
                shortcut=_shortcut_for_operation(operation),
                timestamp=source_timestamp,
                start=start,
                end=end,
                confidence=max(0.1, min(1.0, operation.confidence)),
                quality=max(0, min(100, operation.quality)),
                evidenceCount=max(1, len(support_ids)),
                evidenceIds=support_ids,
                operationId=operation.id,
            )
        )
    return skills


def score_evidence(evidence: list[EvidenceItem], operations: list[OperationCandidate]) -> int:
    score = min(50, len(evidence) * 10)
    score += min(30, len(operations) * 8)
    score += int(sum(item.confidence for item in evidence) * 8)
    score += 5 if any(item.timestamp is not None for item in evidence) else 0
    return max(0, min(100, score))


def build_suggestions(
    payload: VideoLinkAnalysisRequest,
    evidence: list[EvidenceItem],
    operations: list[OperationCandidate],
    resolved_media_url: str | None,
    provider_note: str | None = None,
) -> list[str]:
    suggestions: list[str] = []
    if provider_note:
        suggestions.append(provider_note)
    if payload.source_kind == "direct" and not resolved_media_url:
        suggestions.append("Provide a playable media URL or enable iiiLab resolution for the source page.")
    if not any(item.type in {"transcript", "ocr"} for item in evidence):
        suggestions.append("Add transcript or OCR text to lock the operation name and step order.")
    if not any(item.type == "visual" for item in evidence):
        suggestions.append("Add visual notes or frame descriptions so the final skill can reference actual UI changes.")
    if not operations or operations[0].quality < 55:
        suggestions.append("Add a clearer tool keyword such as mask, curves, liquify, object selection, or healing.")
    if len(evidence) < 3:
        suggestions.append("Add at least three evidence slices so the agent can separate the core operation from incidental UI noise.")
    return _merge_unique(suggestions)


def _build_result(
    *,
    payload: VideoLinkAnalysisRequest,
    message: str,
    skills: list[Skill],
    evidence: list[EvidenceItem],
    operations: list[OperationCandidate],
    evidence_score: int,
    needs_review: bool,
    suggestions: list[str],
    resolved_media_url: str | None,
    provider: str | None,
) -> AnalysisResult:
    return AnalysisResult(
        status="success" if skills else "needs_review",
        message=message,
        skills=skills,
        evidence=evidence,
        operations=operations,
        evidence_score=evidence_score,
        needs_review=needs_review,
        suggestions=suggestions,
        resolved_media_url=resolved_media_url,
        provider=provider,
    )


def _matched_keywords(rule: OperationRule, haystack: str) -> list[str]:
    return [keyword for keyword in rule.keywords if keyword.lower() in haystack]


def _timestamps_for_ids(evidence: list[EvidenceItem], evidence_ids: list[str]) -> list[float]:
    timestamps = [item.timestamp for item in evidence if item.id in evidence_ids and item.timestamp is not None]
    return [float(value) for value in timestamps if value is not None]


def _time_window(evidence: list[EvidenceItem], evidence_ids: list[str]) -> tuple[float, float]:
    timestamps = _timestamps_for_ids(evidence, evidence_ids)
    if not timestamps:
        timestamps = [item.timestamp for item in evidence if item.timestamp is not None]
    timestamps = [float(value) for value in timestamps if value is not None]
    if not timestamps:
        return 0.0, 0.0
    return min(timestamps), max(timestamps)


def _skill_tags(operation: OperationCandidate, software: str) -> list[str]:
    tags = [software, operation.category, operation.label, *operation.matched_keywords[:4]]
    return _merge_unique([tag for tag in tags if tag])


def _skill_description(
    operation: OperationCandidate,
    evidence: list[EvidenceItem],
    summary: str | None = None,
) -> str:
    lead = evidence[0].text.strip() if evidence else operation.label
    if summary:
        return f"{operation.label}: {summary}"
    return f"{operation.label}: {lead[:180]}"


def _shortcut_for_operation(operation: OperationCandidate) -> list[str]:
    if operation.category == "selection":
        return ["W", "Alt"]
    if operation.category == "retouching":
        return ["J", "B"]
    if operation.category == "color":
        return ["Ctrl+M", "Ctrl+U"]
    if operation.category == "compositing":
        return ["Q", "Ctrl+T"]
    if operation.category == "cleanup":
        return ["L", "J", "S"]
    if operation.category == "shape":
        return ["Ctrl+Shift+X"]
    if operation.category == "output":
        return ["Ctrl+Alt+Shift+E"]
    return []


def operation_steps(operation: OperationCandidate) -> list[str]:
    rule = next((item for item in OPERATION_RULES if item.operation == operation.operation), GENERIC_OPERATION_RULE)
    return list(rule.steps)


def _summarize_result(
    payload: VideoLinkAnalysisRequest,
    operations: list[OperationCandidate],
    evidence: list[EvidenceItem],
) -> str:
    if operations:
        top = operations[0]
        return f"Detected {top.label} from {len(evidence)} evidence item(s) for {payload.software}."
    return f"Collected {len(evidence)} evidence item(s) for {payload.software}, but no strong operation match was found."


def _make_evidence(
    kind: str,
    text: str,
    source: str,
    *,
    confidence: float,
) -> EvidenceItem:
    cleaned = _clean_text(text)
    return EvidenceItem(
        id=_stable_id(kind, source, cleaned[:80]),
        type=kind,
        source=source,
        text=cleaned,
        timestamp=None if kind in {"note", "visual"} else _first_numeric_timestamp(cleaned),
        confidence=max(0.0, min(1.0, confidence)),
        weight=2 if kind in {"transcript", "ocr"} else 1,
    )


def _first_numeric_timestamp(text: str) -> float | None:
    match = re.search(r"(\d{1,2}:\d{2}(?::\d{2})?)", text)
    if not match:
        return None
    parts = [float(part) for part in match.group(1).split(":")]
    if len(parts) == 2:
        minutes, seconds = parts
        return minutes * 60 + seconds
    hours, minutes, seconds = parts
    return hours * 3600 + minutes * 60 + seconds


def _first_timestamp(evidence: list[EvidenceItem]) -> str | None:
    timestamps = [item.timestamp for item in evidence if item.timestamp is not None]
    if not timestamps:
        return None
    return _format_timestamp(min(timestamps))


def _format_timestamp(seconds: float) -> str:
    total = max(0, int(seconds))
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def _clean_text(value: str | None) -> str:
    if not value:
        return ""
    return unescape(" ".join(value.split())).strip()


def _extract_html_title(body: str) -> str | None:
    match = re.search(r"<title[^>]*>(.*?)</title>", body, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return None
    title = _clean_text(match.group(1))
    return title or None


def _extract_meta_description(body: str) -> str | None:
    return _extract_meta_content(body, name="description")


def _extract_meta_content(body: str, *, name: str | None = None, property_name: str | None = None) -> str | None:
    if not name and not property_name:
        return None
    attrs = []
    if name:
        attrs.append(rf'name=["\']{re.escape(name)}["\']')
    if property_name:
        attrs.append(rf'property=["\']{re.escape(property_name)}["\']')
    attr_pattern = "|".join(attrs)
    match = re.search(
        rf'<meta[^>]+(?:{attr_pattern})[^>]+content=["\'](.*?)["\']',
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return None
    value = _clean_text(match.group(1))
    return value or None


def _extract_link_canonical(body: str) -> str | None:
    match = re.search(
        r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\'](.*?)["\']',
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return None
    value = _clean_text(match.group(1))
    return value or None


def _detect_provider(url: str) -> str | None:
    host = urlparse(url).netloc.lower()
    if "bilibili" in host:
        return "bilibili"
    if any(token in host for token in ("xiaohongshu", "rednote", "xhslink", "xhs.cn")):
        return "xiaohongshu"
    if "youtube" in host:
        return "youtube"
    if host:
        return host
    return None


def _merge_unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    merged: list[str] = []
    for value in values:
        cleaned = value.strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            merged.append(cleaned)
    return merged


def _stable_id(*parts: Any) -> str:
    joined = "|".join(str(part) for part in parts if part is not None)
    return sha1(joined.encode("utf-8")).hexdigest()[:16]
