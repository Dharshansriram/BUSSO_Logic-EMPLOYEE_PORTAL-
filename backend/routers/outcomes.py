from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from backend.core.auth import require_employee
from backend.core.database import record_audit, fallback_outcomes
from backend.models.schemas import OutcomeRecordRequest
from backend.routers.events import broadcast_event

router = APIRouter(prefix="/outcomes", tags=["outcomes"])

@router.get("")
async def list_outcomes(current_employee: dict = Depends(require_employee)):
    total = len(fallback_outcomes)
    accepted = len([o for o in fallback_outcomes if o.get("actionTaken") == "accepted"])
    rejected = len([o for o in fallback_outcomes if o.get("actionTaken") == "rejected"])
    modified = len([o for o in fallback_outcomes if o.get("actionTaken") == "modified"])
    
    acceptance_rate = round((accepted / max(1, total)) * 100) if total > 0 else 0
    
    return {
        "outcomes": fallback_outcomes,
        "summary": {
            "totalRecorded": total,
            "accepted": accepted,
            "rejected": rejected,
            "modified": modified,
            "acceptanceRate": acceptance_rate,
            "learningStatus": "active_monitoring"
        }
    }

@router.post("/record")
async def record_outcome(req: OutcomeRecordRequest, current_employee: dict = Depends(require_employee)):
    now = datetime.now(timezone.utc).isoformat()
    o_id = len(fallback_outcomes) + 1
    
    entry = {
        "id": o_id,
        "recommendationId": req.recommendationId,
        "interventionType": req.interventionType,
        "actionTaken": req.actionTaken,
        "decisionMaker": current_employee.get("name", req.decisionMaker or "User"),
        "predictedRiskDelta": req.predictedRiskDelta,
        "actualOutcomeObserved": req.actualOutcomeObserved or "On-track execution following intervention",
        "actualDelayHours": req.actualDelayHours or 0.0,
        "notes": req.notes,
        "recordedAt": now
    }
    
    fallback_outcomes.insert(0, entry)
    
    await record_audit(
        current_employee,
        "recorded_outcome",
        "outcome_log",
        o_id,
        f"Recorded {req.actionTaken} action on recommendation #{req.recommendationId or 1}"
    )
    
    broadcast_event("outcome.recorded", entry)
    return entry
