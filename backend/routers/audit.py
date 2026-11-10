from fastapi import APIRouter, Depends
from backend.core.auth import require_manager
from backend.core.database import get_audit_logs

router = APIRouter(prefix="", tags=["audit"])

@router.get("/audit-logs")
async def list_audit_logs(current_employee: dict = Depends(require_manager)):
    return {"logs": await get_audit_logs(100)}
