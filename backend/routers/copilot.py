from fastapi import APIRouter, Depends, HTTPException
from backend.core.auth import require_employee
from backend.core.database import get_dashboard_data, get_people_data, record_audit
from backend.models.schemas import CopilotAskRequest
from backend.intelligence.copilot_engine import ask_copilot

router = APIRouter(prefix="/copilot", tags=["copilot"])

@router.post("/ask")
async def ask_copilot_endpoint(req: CopilotAskRequest, current_employee: dict = Depends(require_employee)):
    if not req.question or len(req.question.strip()) < 2:
        raise HTTPException(status_code=400, detail="A question is required")
        
    dashboard = await get_dashboard_data()
    people = await get_people_data()
    
    result = await ask_copilot(
        question=req.question,
        tasks=dashboard["tasks"],
        employees=people["employees"],
        projects=dashboard["projects"]
    )
    
    await record_audit(
        current_employee,
        "queried",
        "copilot",
        None,
        f"Copilot query: '{req.question[:60]}...'"
    )
    
    return result
