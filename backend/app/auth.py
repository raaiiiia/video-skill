import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException

from .models import (
    AuthEmailCodeRequest,
    AuthEmailCodeResponse,
    AuthLoginRequest,
    AuthRegisterRequest,
    AuthResponse,
    AuthUser,
)
from .store import create_user, get_user


router = APIRouter()

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7
EMAIL_CODE_TTL_SECONDS = 60 * 10
EMAIL_CODE_COOLDOWN_SECONDS = 60
_email_codes: dict[str, tuple[str, float]] = {}


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _validate_email(email: str) -> None:
    if not EMAIL_PATTERN.match(email):
        raise HTTPException(status_code=400, detail="请输入有效邮箱。")


def _secret_key() -> bytes:
    return os.getenv("AUTH_SECRET_KEY", "dev-auth-secret-change-me").encode("utf-8")


def _b64_encode(payload: bytes) -> str:
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def _b64_decode(payload: str) -> bytes:
    padding = "=" * (-len(payload) % 4)
    return base64.urlsafe_b64decode(f"{payload}{padding}")


def _hash_password(password: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 120_000)
    return digest.hex()


def _verify_password(password: str, salt: str, expected_hash: str) -> bool:
    return hmac.compare_digest(_hash_password(password, salt), expected_hash)


def _create_token(email: str) -> str:
    payload = json.dumps(
        {"email": email, "exp": int(time.time()) + TOKEN_TTL_SECONDS},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    encoded_payload = _b64_encode(payload)
    signature = hmac.new(_secret_key(), encoded_payload.encode("ascii"), hashlib.sha256).digest()
    return f"{encoded_payload}.{_b64_encode(signature)}"


def _read_token(token: str) -> str:
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        expected = hmac.new(_secret_key(), encoded_payload.encode("ascii"), hashlib.sha256).digest()
        actual = _b64_decode(encoded_signature)
        if not hmac.compare_digest(expected, actual):
            raise ValueError("bad signature")
        payload = json.loads(_b64_decode(encoded_payload).decode("utf-8"))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=401, detail="登录已失效，请重新登录。") from None

    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录。")
    email = _normalize_email(str(payload.get("email", "")))
    _validate_email(email)
    return email


def _auth_response(user: dict[str, str]) -> AuthResponse:
    profile = AuthUser(name=user["name"], email=user["email"])
    return AuthResponse(token=_create_token(user["email"]), user=profile)


def current_user(authorization: Annotated[str | None, Header()] = None) -> AuthUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="请先注册或登录后再使用该接口。")
    email = _read_token(authorization.removeprefix("Bearer ").strip())
    user = get_user(email)
    if not user:
        raise HTTPException(status_code=401, detail="账号不存在，请重新登录。")
    return AuthUser(name=user["name"], email=user["email"])


@router.post("/send-code", response_model=AuthEmailCodeResponse)
def send_code(payload: AuthEmailCodeRequest):
    email = _normalize_email(payload.email)
    _validate_email(email)
    existing = _email_codes.get(email)
    now = time.time()
    if existing and now - existing[1] < EMAIL_CODE_COOLDOWN_SECONDS:
        code = existing[0]
    else:
        code = str(secrets.randbelow(900000) + 100000)
        _email_codes[email] = (code, now)

    return AuthEmailCodeResponse(
        code=code,
        cooldown_seconds=EMAIL_CODE_COOLDOWN_SECONDS,
        message="验证码已生成。当前版本用于本地演示，会直接返回验证码。",
    )


@router.post("/register", response_model=AuthResponse)
def register(payload: AuthRegisterRequest):
    email = _normalize_email(payload.email)
    name = payload.name.strip()
    _validate_email(email)

    if len(name) < 1:
        raise HTTPException(status_code=400, detail="请输入账号名称。")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位。")
    if get_user(email):
        raise HTTPException(status_code=409, detail="这个邮箱已经注册。")

    code_record = _email_codes.get(email)
    if not code_record:
        raise HTTPException(status_code=400, detail="请先获取邮箱验证码。")
    code, sent_at = code_record
    if time.time() - sent_at > EMAIL_CODE_TTL_SECONDS or code != payload.email_code.strip():
        raise HTTPException(status_code=400, detail="邮箱验证码不正确或已过期。")

    salt = secrets.token_hex(16)
    user = create_user(email, name, _hash_password(payload.password, salt), salt)
    _email_codes.pop(email, None)
    return _auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(payload: AuthLoginRequest):
    email = _normalize_email(payload.email)
    _validate_email(email)
    user = get_user(email)
    if not user or not _verify_password(payload.password, user["password_salt"], user["password_hash"]):
        raise HTTPException(status_code=401, detail="邮箱或密码不正确。")
    return _auth_response(user)


@router.get("/me", response_model=AuthUser)
def me(user: Annotated[AuthUser, Depends(current_user)]):
    return user
