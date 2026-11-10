from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from backend.core.auth import require_employee
from backend.core.database import (
    get_dashboard_data,
    get_people_data,
    record_audit,
    fallback_simulations
)
from backend.models.schemas import SimulatorCompareRequest
from backend.intelligence.decision_simulator import simulate_intervention

router = APIRouter(prefix="/simulator", tags=["simulator"])

@router.post("/compare")
async def compare_intervention(req: SimulatorCompareRequest, current_employee: dict = Depends(require_employee)):
    dashboard = await get_dashboard_data()
    people = await get_people_data()
    
    result = simulate_intervention(
        tasks=dashboard["tasks"],
        employees=people["employees"],
        intervention_type=req.interventionType,
        task_id=req.taskId,
        target_assignee=req.targetAssignee,
        priority_change=req.priorityChange,
        schedule_adjustment_hours=req.scheduleAdjustmentHours,
        notes=req.notes
    )
    
    history_entry = {
        "id": len(fallback_simulations) + 1,
        "simulatedAt": datetime.now(timezone.utc).isoformat(),
        "simulatedBy": current_employee.get("name", "User"),
        **result
    }
    fallback_simulations.insert(0, history_entry)
    
    await record_audit(
        current_employee,
        "simulated",
        "decision_simulator",
        req.taskId,
        f"Simulated {req.interventionType} on task #{req.taskId or 1}"
    )
    
    return result

@router.get("/history")
async def get_simulation_history(current_employee: dict = Depends(require_employee)):
    return {"history": fallback_simulations[:20]}
