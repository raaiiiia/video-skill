from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

import requests


class GeminiClientError(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(os.getenv("GEMINI_API_KEY"))


@dataclass(frozen=True)
class GeminiResponse:
    text: str
    raw: dict[str, Any]


class GeminiClient:
    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = model or os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
        self.timeout = timeout or float(os.getenv("GEMINI_TIMEOUT", "60"))

        if not self.api_key:
            raise GeminiClientError("GEMINI_API_KEY is not configured.")

    @property
    def endpoint(self) -> str:
        return f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"

    def generate_json(
        self,
        prompt: str,
        *,
        system_instruction: str | None = None,
        schema: dict[str, Any] | None = None,
        temperature: float = 0.2,
        max_output_tokens: int = 2048,
    ) -> dict[str, Any]:
        return self.generate_json_from_contents(
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            system_instruction=system_instruction,
            schema=schema,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )

    def generate_json_from_contents(
        self,
        contents: list[dict[str, Any]],
        *,
        system_instruction: str | None = None,
        schema: dict[str, Any] | None = None,
        temperature: float = 0.2,
        max_output_tokens: int = 2048,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_output_tokens,
                "responseMimeType": "application/json",
            },
        }
        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}],
            }
        if schema:
            payload["generationConfig"]["responseJsonSchema"] = schema

        response = requests.post(
            self.endpoint,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": self.api_key,
            },
            json=payload,
            timeout=self.timeout,
        )
        if response.status_code >= 400:
            raise GeminiClientError(f"Gemini API returned HTTP {response.status_code}: {response.text[:500]}")

        try:
            data = response.json()
        except ValueError as exc:
            raise GeminiClientError("Gemini API did not return JSON.") from exc

        text = self._extract_text(data)
        if not text:
            raise GeminiClientError("Gemini API returned no usable content.")

        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise GeminiClientError(f"Gemini JSON could not be parsed: {text[:500]}") from exc

    def generate_json_with_image(
        self,
        image_bytes: bytes,
        *,
        mime_type: str | None = None,
        prompt: str,
        system_instruction: str | None = None,
        schema: dict[str, Any] | None = None,
        temperature: float = 0.2,
        max_output_tokens: int = 2048,
    ) -> dict[str, Any]:
        import base64

        resolved_mime_type = mime_type or "image/png"
        contents = [
            {
                "role": "user",
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": resolved_mime_type,
                            "data": base64.b64encode(image_bytes).decode("ascii"),
                        }
                    },
                    {"text": prompt},
                ],
            }
        ]
        return self.generate_json_from_contents(
            contents,
            system_instruction=system_instruction,
            schema=schema,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )

    def _extract_text(self, payload: dict[str, Any]) -> str:
        candidates = payload.get("candidates") or []
        for candidate in candidates:
            content = candidate.get("content") or {}
            parts = content.get("parts") or []
            texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
            text = "".join(texts).strip()
            if text:
                return text
        return ""
