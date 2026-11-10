import asyncio
from backend.core.auth import hash_password, verify_password, authenticate_employee

def test_password_hashing():
    raw = "SecureSecret123!"
    hashed = hash_password(raw)
    assert ":" in hashed
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False

def test_demo_auth():
    emp = asyncio.run(authenticate_employee("maya@acme.test", "Welcome123!"))
    assert emp is not None
    assert emp["name"] == "Maya Chen"
    assert "passwordHash" not in emp

def test_invalid_auth():
    emp = asyncio.run(authenticate_employee("maya@acme.test", "WrongPassword!"))
    assert emp is None
