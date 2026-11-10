from fastapi import APIRouter, Depends, HTTPException
from backend.core.auth import require_employee
from backend.core.database import get_dashboard_data

router = APIRouter(prefix="", tags=["dashboard"])

@router.get("/dashboard")
async def get_dashboard(current_employee: dict = Depends(require_employee)):
    try:
        return await get_dashboard_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to load dashboard: {str(e)}")
