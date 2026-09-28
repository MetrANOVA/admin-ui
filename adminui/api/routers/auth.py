"""Cookie-based login for the mock API (issue #8).

Stand-in until the real API has authentication. Users come from either
ADMINUI_AUTH_USERS ("alice:secret,bob:hunter2") or ADMINUI_AUTH_HTPASSWD (an
Apache htpasswd file; $apr1$, {SHA} and plain entries). With neither set, auth
is off: /auth/me answers with a developer user and /auth/check always passes,
so local development is unaffected.

A successful login sets an HttpOnly cookie signed with ADMINUI_AUTH_SECRET.
If the secret is not set, a random one is generated at start-up, so sessions
end whenever the process restarts. /auth/check is shaped for nginx's
auth_request, which is how the test server gates the whole app on the cookie.
"""

import base64
import hashlib
import hmac
import logging
import os
import secrets
import time

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "adminui_session"
SESSION_SECONDS = 12 * 60 * 60
REMEMBER_SECONDS = 30 * 24 * 60 * 60

_SECRET = os.environ.get("ADMINUI_AUTH_SECRET") or secrets.token_hex(32)
if "ADMINUI_AUTH_SECRET" not in os.environ:
    logger.warning("ADMINUI_AUTH_SECRET not set; sessions will not survive a restart")


# --- user store -------------------------------------------------------------

_ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"


def _to64(value: int, count: int) -> str:
    out = ""
    for _ in range(count):
        out += _ITOA64[value & 0x3F]
        value >>= 6
    return out


def _apr1(password: str, salt: str) -> str:
    """Apache's MD5-based htpasswd hash ($apr1$), as written by `htpasswd -m`."""
    pw = password.encode()
    s = salt.encode()
    ctx = hashlib.md5(pw + b"$apr1$" + s)
    alt = hashlib.md5(pw + s + pw).digest()
    i = len(pw)
    while i > 0:
        ctx.update(alt[: min(16, i)])
        i -= 16
    i = len(pw)
    while i > 0:
        ctx.update(b"\0" if i & 1 else pw[:1])
        i >>= 1
    final = ctx.digest()
    for i in range(1000):
        ctx = hashlib.md5()
        ctx.update(pw if i & 1 else final)
        if i % 3:
            ctx.update(s)
        if i % 7:
            ctx.update(pw)
        ctx.update(final if i & 1 else pw)
        final = ctx.digest()
    f = final
    encoded = (
        _to64((f[0] << 16) | (f[6] << 8) | f[12], 4)
        + _to64((f[1] << 16) | (f[7] << 8) | f[13], 4)
        + _to64((f[2] << 16) | (f[8] << 8) | f[14], 4)
        + _to64((f[3] << 16) | (f[9] << 8) | f[15], 4)
        + _to64((f[4] << 16) | (f[10] << 8) | f[5], 4)
        + _to64(f[11], 2)
    )
    return f"$apr1${salt}${encoded}"


def _matches(stored: str, password: str) -> bool:
    if stored.startswith("$apr1$"):
        salt = stored.split("$")[2]
        return hmac.compare_digest(_apr1(password, salt), stored)
    if stored.startswith("{SHA}"):
        digest = base64.b64encode(hashlib.sha1(password.encode()).digest()).decode()
        return hmac.compare_digest("{SHA}" + digest, stored)
    return hmac.compare_digest(stored, password)


def _load_users() -> dict[str, str]:
    users: dict[str, str] = {}
    for pair in os.environ.get("ADMINUI_AUTH_USERS", "").split(","):
        if ":" in pair:
            name, secret = pair.split(":", 1)
            users[name.strip()] = secret
    path = os.environ.get("ADMINUI_AUTH_HTPASSWD")
    if path:
        try:
            with open(path, encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if line and not line.startswith("#") and ":" in line:
                        name, secret = line.split(":", 1)
                        users[name] = secret
        except OSError as exc:
            logger.error("Cannot read ADMINUI_AUTH_HTPASSWD %s: %s", path, exc)
    return users


def auth_enabled() -> bool:
    return bool(os.environ.get("ADMINUI_AUTH_USERS") or os.environ.get("ADMINUI_AUTH_HTPASSWD"))


# --- session cookie ---------------------------------------------------------


def _sign(payload: str) -> str:
    return hmac.new(_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()


def _issue(username: str, seconds: int) -> str:
    payload = base64.urlsafe_b64encode(f"{username}|{int(time.time()) + seconds}".encode()).decode()
    return f"{payload}.{_sign(payload)}"


def _verify(token: str | None) -> str | None:
    if not token or "." not in token:
        return None
    payload, signature = token.rsplit(".", 1)
    if not hmac.compare_digest(_sign(payload), signature):
        return None
    try:
        username, expires = base64.urlsafe_b64decode(payload.encode()).decode().rsplit("|", 1)
    except (ValueError, UnicodeDecodeError):
        return None
    if int(expires) < time.time():
        return None
    return username


def current_user(request: Request) -> str | None:
    if not auth_enabled():
        return "developer"
    return _verify(request.cookies.get(COOKIE_NAME))


def _secure(request: Request) -> bool:
    return request.headers.get("x-forwarded-proto", request.url.scheme) == "https"


# --- routes -----------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str
    password: str
    remember: bool = False


@router.post("/login", summary="Log in and receive a session cookie")
def login(body: LoginRequest, request: Request, response: Response):
    if not auth_enabled():
        return {"username": "developer", "enabled": False}
    stored = _load_users().get(body.username)
    if stored is None or not _matches(stored, body.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    seconds = REMEMBER_SECONDS if body.remember else SESSION_SECONDS
    response.set_cookie(
        COOKIE_NAME,
        _issue(body.username, seconds),
        max_age=seconds if body.remember else None,
        httponly=True,
        samesite="lax",
        secure=_secure(request),
        path="/",
    )
    return {"username": body.username, "enabled": True}


@router.post("/logout", summary="Clear the session cookie")
def logout(request: Request, response: Response):
    response.delete_cookie(COOKIE_NAME, path="/", httponly=True, samesite="lax", secure=_secure(request))
    return {"ok": True}


@router.get("/me", summary="Who is logged in (401 when nobody is)")
def me(request: Request):
    username = current_user(request)
    if username is None:
        raise HTTPException(status_code=401, detail="Not logged in")
    return {"username": username, "enabled": auth_enabled()}


@router.get("/check", summary="For nginx auth_request: 200 with a valid session, else 401")
def check(request: Request):
    username = current_user(request)
    if username is None:
        raise HTTPException(status_code=401, detail="Not logged in")
    return Response(status_code=204, headers={"X-Auth-User": username})
