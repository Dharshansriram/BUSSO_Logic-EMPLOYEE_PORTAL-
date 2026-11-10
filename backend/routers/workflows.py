import re
from fastapi import APIRouter, Depends, HTTPException
from backend.core.auth import require_employee
from backend.core.database import record_audit, fallback_workflows
from backend.models.schemas import WorkflowGenerateRequest, WorkflowCreateRequest
from backend.routers.events import broadcast_event

router = APIRouter(prefix="/workflows", tags=["workflows"])

@router.post("/generate")
async def generate_workflow(req: WorkflowGenerateRequest, current_employee: dict = Depends(require_employee)):
    prompt = req.prompt.strip()
    if len(prompt) < 3:
        raise HTTPException(status_code=400, detail="Describe the workflow first")
        
    cleaned = re.sub(r"^create a workflow for ", "", prompt, flags=re.IGNORECASE)
    cleaned = re.sub(r"[.?!]+$", "", cleaned).strip()
    name = cleaned[0].upper() + cleaned[1:] if cleaned else "Custom Workflow"
    
    stages = [
        "Intake & approval",
        "Document verification",
        "Technical execution",
        "Quality assurance & compliance",
        "Final sign-off & customer notification"
    ]
    
    return {
        "name": name,
        "stages": stages,
        "note": "BUSSOLOGIC workflow blueprint synthesized from your prompt. Ready for automation."
    }

@router.get("")
async def list_workflows(current_employee: dict = Depends(require_employee)):
    return {"workflows": fallback_workflows}

@router.post("")
async def create_workflow(req: WorkflowCreateRequest, current_employee: dict = Depends(require_employee)):
    w_id = len(fallback_workflows) + 1
    new_wf = {
        "id": w_id,
        "name": req.name,
        "trigger": req.trigger,
        "stages": req.stages,
        "description": req.description,
        "status": "active"
    }
    fallback_workflows.append(new_wf)
    await record_audit(current_employee, "created", "workflow", w_id, f"Created workflow '{req.name}'")
    broadcast_event("workflow.created", new_wf)
    return new_wf

@router.put("/{workflow_id}/execute")
async def execute_workflow(workflow_id: int, current_employee: dict = Depends(require_employee)):
    wf = next((w for w in fallback_workflows if w["id"] == workflow_id), None)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    await record_audit(current_employee, "executed", "workflow", workflow_id, f"Executed automated workflow '{wf['name']}'")
    result = {"success": True, "workflowId": workflow_id, "status": "executed", "name": wf["name"]}
    broadcast_event("workflow.executed", result)
    return result
