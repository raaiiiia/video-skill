from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import requests


class IiiLabNotConfigured(RuntimeError):
    pass


class IiiLabResolveError(RuntimeError):
    pass


@dataclass(frozen=True)
class ResolvedVideo:
    media_url: str | None
    title: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None
    raw: dict[str, Any] | None = None


MEDIA_EXTENSIONS = (".mp4", ".m3u8", ".webm", ".mov", ".m4v")
TITLE_KEYS = ("title", "name", "text", "desc", "description", "caption")
THUMBNAIL_KEYS = ("cover", "thumbnail", "thumb", "poster", "image")


def is_configured() -> bool:
    return bool(os.getenv("IIILAB_API_ENDPOINT"))


def resolve_video(source_url: str) -> ResolvedVideo:
    endpoint = os.getenv("IIILAB_API_ENDPOINT")
    if not endpoint:
        raise IiiLabNotConfigured("IIILAB_API_ENDPOINT is not configured.")

    timeout = float(os.getenv("IIILAB_TIMEOUT", "20"))
    headers = {"Accept": "application/json"}
    client_id = os.getenv("IIILAB_CLIENT_ID")
    client_secret = os.getenv("IIILAB_CLIENT_SECRET")
    if client_id and client_secret:
        headers["x-client-id"] = client_id
        headers["x-client-secret"] = client_secret

    token = os.getenv("IIILAB_API_TOKEN") or os.getenv("IIILAB_API_KEY")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    payload = {"url": source_url}
    response = requests.post(endpoint, json=payload, headers=headers, timeout=timeout)
    if response.status_code == 405:
        response = requests.get(endpoint, params=payload, headers=headers, timeout=timeout)

    if response.status_code >= 400:
        raise IiiLabResolveError(f"iiilab API returned HTTP {response.status_code}.")

    try:
        data = response.json()
    except ValueError as exc:
        raise IiiLabResolveError("iiilab API did not return JSON.") from exc

    media_url = _find_media_url(data)
    title = _find_first_text(data, ("title", "name", "text", "caption"))
    description = _find_first_text(data, ("desc", "description", "summary"))
    thumbnail_url = _find_url_by_key(data, THUMBNAIL_KEYS)
    return ResolvedVideo(
        media_url=media_url,
        title=title,
        description=description,
        thumbnail_url=thumbnail_url,
        raw=data if isinstance(data, dict) else {"data": data},
    )


def _find_media_url(value: Any) -> str | None:
    if isinstance(value, str):
        lowered = value.lower().split("?")[0]
        if lowered.startswith(("http://", "https://")) and lowered.endswith(MEDIA_EXTENSIONS):
            return value
        return None

    if isinstance(value, list):
        for item in value:
            found = _find_media_url(item)
            if found:
                return found
        return None

    if isinstance(value, dict):
        preferred_keys = ("resource_url", "url", "video", "video_url", "play_url", "download_url", "src")
        for key in preferred_keys:
            found = _find_media_url(value.get(key))
            if found:
                return found
        for item in value.values():
            found = _find_media_url(item)
            if found:
                return found

    return None


def _find_first_text(value: Any, keys: tuple[str, ...]) -> str | None:
    if isinstance(value, dict):
        for key in keys:
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.strip() and not candidate.startswith(("http://", "https://")):
                return candidate.strip()
        for item in value.values():
            found = _find_first_text(item, keys)
            if found:
                return found

    if isinstance(value, list):
        for item in value:
            found = _find_first_text(item, keys)
            if found:
                return found

    return None


def _find_url_by_key(value: Any, keys: tuple[str, ...]) -> str | None:
    if isinstance(value, dict):
        for key in keys:
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.startswith(("http://", "https://")):
                return candidate
        for item in value.values():
            found = _find_url_by_key(item, keys)
            if found:
                return found

    if isinstance(value, list):
        for item in value:
            found = _find_url_by_key(item, keys)
            if found:
                return found

    return None
