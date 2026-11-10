from fastapi import APIRouter, Depends, HTTPException
from backend.core.auth import require_employee, require_manager
from backend.core.database import (
    get_tasks,
    create_task,
    update_task_status,
    resolve_alert,
    record_audit
)
from backend.models.schemas import TaskStatusUpdateRequest, TaskCreateRequest
from backend.routers.events import broadcast_event

router = APIRouter(prefix="", tags=["tasks"])

@router.get("/tasks")
async def list_tasks(current_employee: dict = Depends(require_employee)):
    return {"tasks": await get_tasks()}

@router.post("/tasks")
async def add_task(req: TaskCreateRequest, current_employee: dict = Depends(require_manager)):
    task = await create_task(req.model_dump())
    await record_audit(current_employee, "created", "task", task["id"], f"Created task '{task['title']}'")
    broadcast_event("task.created", task)
    return task

@router.patch("/tasks/{task_id}/status")
async def change_task_status(task_id: int, req: TaskStatusUpdateRequest, current_employee: dict = Depends(require_employee)):
    status = req.status
    if status not in ("todo", "in_progress", "done", "blocked"):
        raise HTTPException(status_code=400, detail="Invalid task status")
    
    # Employees may only move their own tasks; managers/admins may move any.
    if current_employee.get("role") not in ("manager", "admin"):
        mine = [t for t in await get_tasks() if t.get("id") == task_id]
        if not mine:
            raise HTTPException(status_code=404, detail="Task not found")
        if str(mine[0].get("assignee", "")).strip().lower() != str(current_employee.get("name", "")).strip().lower():
            raise HTTPException(status_code=403, detail="You can only update tasks assigned to you")

    updated = await update_task_status(task_id, status)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
        
    await record_audit(current_employee, "updated", "task", task_id, f"Changed task status to {status}")
    result = {"success": True, "taskId": task_id, "status": status}
    broadcast_event("task.updated", result)
    return result

@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert_endpoint(alert_id: int, current_employee: dict = Depends(require_manager)):
    await resolve_alert(alert_id)
    await record_audit(current_employee, "resolved", "alert", alert_id, f"Resolved alert #{alert_id}")
    result = {"success": True, "alertId": alert_id}
    broadcast_event("alert.resolved", result)
    return result
