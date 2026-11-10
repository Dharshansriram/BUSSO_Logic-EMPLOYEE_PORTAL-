from fastapi import APIRouter, Response, Request, HTTPException, Depends
from backend.core.config import settings
from backend.core.auth import (
    authenticate_employee,
    create_employee_session,
    delete_employee_session,
    get_current_employee,
    get_session_token,
    create_password_reset,
    reset_employee_password
)
from backend.models.schemas import LoginRequest, ForgotPasswordRequest, ResetPasswordRequest

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
async def login(req: LoginRequest, response: Response):
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    employee = await authenticate_employee(req.email, req.password)
    if not employee:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = await create_employee_session(employee["id"])
    response.set_cookie(
        key=settings.SESSION_COOKIE,
        value=token,
        max_age=12 * 3600,
        httponly=True,
        samesite="lax",
        path="/"
    )
    return {"employee": employee, "token": token}

@router.get("/me")
async def me(employee: dict = Depends(get_current_employee)):
    if not employee:
        raise HTTPException(status_code=401, detail="Not signed in")
    return {"employee": employee}

@router.post("/logout")
async def logout(request: Request, response: Response):
    token = get_session_token(request)
    if token:
        await delete_employee_session(token)
    response.delete_cookie(key=settings.SESSION_COOKIE, path="/")
    return {"success": True}

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    email = req.email.strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    result = await create_password_reset(email)
    return {
        "success": True,
        "message": "If the account exists, reset instructions have been created.",
        "resetToken": result["token"]
    }

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    if not req.token or not req.password or len(req.password) < 8:
        raise HTTPException(status_code=400, detail="A valid token and password of at least 8 characters are required")
    success = await reset_employee_password(req.token, req.password)
    if not success:
        raise HTTPException(status_code=400, detail="Reset token is invalid or expired")
    return {"success": True}
