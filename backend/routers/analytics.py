from fastapi import APIRouter, Depends, HTTPException
from backend.core.auth import require_employee, require_manager
from backend.core.database import (
    get_dashboard_data,
    get_people_data,
    create_notification
)
from backend.intelligence.predictions import calculate_predictions
from backend.intelligence.workload import calculate_workload
from backend.intelligence.recommendations import generate_recommendations
from backend.ml.pipeline import get_ml_metrics
from backend.routers.events import broadcast_event

router = APIRouter(prefix="/analytics", tags=["analytics"])

async def analyze_operations_internal():
    dashboard = await get_dashboard_data()
    people = await get_people_data()
    predictions = calculate_predictions(dashboard["tasks"], people["employees"])
    workload = calculate_workload(people["employees"], dashboard["tasks"])
    alerts = [p for p in predictions if p["probability"] >= 55]
    
    avg_util = (
        round(sum(w["utilization"] for w in workload) / max(1, len(workload)))
        if workload else 0
    )
    overloaded = len([w for w in workload if w["loadBand"] == "overloaded"])
    
    return {
        "predictions": predictions,
        "workload": workload,
        "summary": {
            "averageUtilization": avg_util,
            "overloaded": overloaded,
            "highRiskTasks": len(alerts)
        }
    }

@router.get("/workload")
async def get_workload_analysis(current_employee: dict = Depends(require_employee)):
    return await analyze_operations_internal()

@router.get("/predictions")
async def get_predictions(current_employee: dict = Depends(require_employee)):
    result = await analyze_operations_internal()
    ml_metrics = get_ml_metrics()
    return {
        "predictions": result["predictions"],
        "summary": result["summary"],
        "mlModel": ml_metrics
    }

@router.get("/recommendations")
async def get_recommendations(current_employee: dict = Depends(require_employee)):
    dashboard = await get_dashboard_data()
    people = await get_people_data()
    return await generate_recommendations(dashboard["tasks"], people["employees"])

@router.post("/notify-at-risk")
async def notify_at_risk(current_employee: dict = Depends(require_manager)):
    analysis = await analyze_operations_internal()
    at_risk = [p for p in analysis["predictions"] if p["probability"] >= 55]
    
    for item in at_risk:
        person = next((p for p in analysis["workload"] if p["name"] == item["assignee"]), None)
        if person and person.get("email"):
            await create_notification({
                "employeeEmail": person["email"],
                "title": f"BUSSOLOGIC Delivery Risk: {item['taskTitle']}",
                "body": item["recommendedAction"],
                "channel": "in_app"
            })
            
    result = {"notified": len(at_risk), "tasks": at_risk}
    broadcast_event("notifications", result)
    return result

@router.get("/ml-model")
async def get_model_status(current_employee: dict = Depends(require_employee)):
    return get_ml_metrics()
