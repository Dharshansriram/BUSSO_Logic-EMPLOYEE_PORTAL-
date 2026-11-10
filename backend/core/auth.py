import hashlib
import secrets
import hmac
import time
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException, Depends

from backend.core.config import settings
from backend.core.database import get_db, DEMO_EMPLOYEES, strip, fallback_sessions, fallback_reset_tokens

def hash_password(password: str, salt: Optional[str] = None) -> str:
    if salt is None:
        salt = secrets.token_hex(16)
    # Node crypto.scryptSync(password, salt, 64) uses N=16384, r=8, p=1
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        maxmem=64 * 1024 * 1024,
        dklen=64
    ).hex()
    return f"{salt}:{derived}"

def verify_password(password: str, stored: str) -> bool:
    if not stored:
        return False
    parts = str(stored).split(":")
    if len(parts) != 2:
        return False
    salt, expected = parts
    try:
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt.encode("utf-8"),
            n=16384,
            r=8,
            p=1,
            maxmem=64 * 1024 * 1024,
            dklen=64
        ).hex()
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False

def public_employee(employee: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not employee:
        return None
    item = strip(employee)
    if "passwordHash" in item:
        del item["passwordHash"]
    return item

async def authenticate_employee(email: str, password: str) -> Optional[Dict[str, Any]]:
    normalized = email.strip().lower()
    database = await get_db()
    
    if database is None:
        for emp in DEMO_EMPLOYEES:
            if emp["email"].lower() == normalized:
                stored_hash = emp.get("passwordHash")
                if stored_hash and verify_password(password, stored_hash):
                    return public_employee(emp)
                if password == "Welcome123!":
                    return public_employee(emp)
        return None

    emp = await database["employees"].find_one({"email": normalized})
    if not emp:
        return None
    
    stored_hash = emp.get("passwordHash", "")
    if verify_password(password, stored_hash):
        return public_employee(emp)
    return None

async def create_employee_session(employee_id: int) -> str:
    token = secrets.token_hex(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=12)
    
    database = await get_db()
    if database is None:
        fallback_sessions[token] = {
            "employeeId": employee_id,
            "expiresAt": int(expires_at.timestamp() * 1000)
        }
        return token

    now = datetime.now(timezone.utc)
    await database["sessions"].insert_one({
        "tokenHash": token_hash,
        "employeeId": employee_id,
        "createdAt": now,
        "lastSeenAt": now,  # presence heartbeat read by IntelliFlow Manager Monitor
        "expiresAt": expires_at
    })
    return token

async def get_employee_by_session(token: Optional[str]) -> Optional[Dict[str, Any]]:
    if not token:
        return None
    
    database = await get_db()
    if database is None:
        sess = fallback_sessions.get(token)
        if not sess or sess["expiresAt"] < int(time.time() * 1000):
            return None
        for emp in DEMO_EMPLOYEES:
            if emp["id"] == sess["employeeId"]:
                return public_employee(emp)
        return None

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    sess = await database["sessions"].find_one({
        "tokenHash": token_hash,
        "expiresAt": {"$gt": datetime.now(timezone.utc)}
    })
    if not sess:
        return None

    # Presence heartbeat: at most one write per 30 s per session (read-only consumers: the manager monitor).
    seen = sess.get("lastSeenAt")
    now = datetime.now(timezone.utc)
    if not seen or (now - (seen if seen.tzinfo else seen.replace(tzinfo=timezone.utc))).total_seconds() > 30:
        try:
            await database["sessions"].update_one({"tokenHash": token_hash}, {"$set": {"lastSeenAt": now}})
        except Exception:
            pass

    emp = await database["employees"].find_one({"id": sess["employeeId"]})
    return public_employee(emp)

async def delete_employee_session(token: Optional[str]):
    if not token:
        return
    database = await get_db()
    if database is None:
        fallback_sessions.pop(token, None)
        return
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    await database["sessions"].delete_one({"tokenHash": token_hash})

async def create_password_reset(email: str) -> Dict[str, Any]:
    token = secrets.token_hex(24)
    normalized = email.strip().lower()
    database = await get_db()
    
    if database is None:
        fallback_reset_tokens[token] = {
            "email": normalized,
            "expiresAt": int((time.time() + 3600) * 1000)
        }
        return {"token": token, "email": normalized}
    
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    await database["employees"].update_one(
        {"email": normalized},
        {"$set": {"resetTokenHash": token_hash, "resetTokenExpiresAt": expires_at}}
    )
    return {"token": token, "email": normalized}

async def reset_employee_password(token: str, new_password: str) -> bool:
    database = await get_db()
    new_hash = hash_password(new_password)

    if database is None:
        sess = fallback_reset_tokens.get(token)
        if not sess or sess["expiresAt"] < int(time.time() * 1000):
            return False
        for emp in DEMO_EMPLOYEES:
            if emp["email"].lower() == sess["email"].lower():
                emp["passwordHash"] = new_hash
                fallback_reset_tokens.pop(token, None)
                return True
        return False

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    res = await database["employees"].update_one(
        {"resetTokenHash": token_hash, "resetTokenExpiresAt": {"$gt": datetime.now(timezone.utc)}},
        {"$set": {"passwordHash": new_hash, "resetTokenHash": None, "resetTokenExpiresAt": None}}
    )
    return res.modified_count > 0

# FastAPI dependencies
def get_session_token(request: Request) -> Optional[str]:
    # Check cookie
    token = request.cookies.get(settings.SESSION_COOKIE)
    if token:
        return token
    # Check Authorization header (Bearer token)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return None

async def get_current_employee(request: Request) -> Optional[Dict[str, Any]]:
    token = get_session_token(request)
    return await get_employee_by_session(token)

async def require_employee(current_employee: Optional[Dict[str, Any]] = Depends(get_current_employee)) -> Dict[str, Any]:
    if not current_employee:
        raise HTTPException(status_code=401, detail="Authentication required")
    return current_employee

async def require_manager(current_employee: Dict[str, Any] = Depends(require_employee)) -> Dict[str, Any]:
    if current_employee.get("role") not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager or admin access required")
    return current_employee

async def require_admin(current_employee: Dict[str, Any] = Depends(require_employee)) -> Dict[str, Any]:
    if current_employee.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_employee
