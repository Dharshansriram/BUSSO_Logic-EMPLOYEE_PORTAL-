from fastapi import APIRouter, Depends, HTTPException
from backend.core.auth import require_employee, require_manager, require_admin
from backend.core.database import (
    get_people_data,
    create_employee,
    update_employee_role,
    create_schedule,
    create_invitation,
    create_notification,
    record_audit
)
from backend.models.schemas import (
    EmployeeCreateRequest,
    EmployeeRoleUpdateRequest,
    ScheduleCreateRequest,
    InvitationCreateRequest
)
from backend.routers.events import broadcast_event

router = APIRouter(prefix="", tags=["people"])

@router.get("/people")
async def list_people(current_employee: dict = Depends(require_employee)):
    return await get_people_data()

@router.post("/employees")
async def add_employee(req: EmployeeCreateRequest, current_employee: dict = Depends(require_manager)):
    if not req.name or not req.email or not req.department or not req.roleTitle or not req.skills:
        raise HTTPException(status_code=400, detail="name, email, department, roleTitle, and skills are required")
    
    emp = await create_employee(req.model_dump())
    await record_audit(current_employee, "created", "employee", emp["id"], f"Created employee {emp['name']}")
    broadcast_event("employee.created", emp)
    return emp

@router.patch("/employees/{employee_id}/role")
async def change_role(employee_id: int, req: EmployeeRoleUpdateRequest, current_employee: dict = Depends(require_admin)):
    role = req.role.strip()
    if role not in ("employee", "manager", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    
    emp = await update_employee_role(employee_id, role)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    await record_audit(current_employee, "changed_role", "employee", employee_id, f"Changed role to {role}")
    return emp

@router.post("/schedules")
async def add_schedule(req: ScheduleCreateRequest, current_employee: dict = Depends(require_manager)):
    sched = await create_schedule(req.model_dump())
    await record_audit(current_employee, "created", "schedule", sched["id"], f"Created {sched['type']} schedule block")
    broadcast_event("schedule.created", sched)
    return sched

@router.post("/invitations")
async def add_invitation(req: InvitationCreateRequest, current_employee: dict = Depends(require_manager)):
    data = req.model_dump()
    data["invitedBy"] = current_employee.get("name", "Maya Chen")
    inv = await create_invitation(data)
    
    await create_notification({
        "employeeEmail": inv["email"],
        "title": "BUSSOLOGIC workspace invitation",
        "body": f"You were invited as {inv['role']} in {inv['department']}. Ask your administrator for the secure invitation link.",
        "channel": "email"
    })
    
    await record_audit(current_employee, "invited", "employee", None, f"Created invitation for {inv['email']}")
    broadcast_event("invitation.created", inv)
    return {
        **inv,
        "delivery": "Invitation queued in the email outbox. Connect SMTP or SendGrid to deliver externally."
    }
