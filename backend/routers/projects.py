from fastapi import APIRouter, Depends, HTTPException
from backend.core.auth import require_employee
from backend.core.database import get_projects, create_project, record_audit
from backend.models.schemas import ProjectCreateRequest
from backend.routers.events import broadcast_event

router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("")
async def list_projects(current_employee: dict = Depends(require_employee)):
    return {"projects": await get_projects()}

@router.post("")
async def add_project(req: ProjectCreateRequest, current_employee: dict = Depends(require_employee)):
    project = await create_project(req.model_dump())
    await record_audit(current_employee, "created", "project", project["id"], f"Created project '{project['name']}'")
    broadcast_event("project.created", project)
    return project
