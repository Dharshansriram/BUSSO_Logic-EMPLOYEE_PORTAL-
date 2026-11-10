from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field

# Authentication
class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

# Tasks & Projects
class TaskStatusUpdateRequest(BaseModel):
    status: str

class TaskCreateRequest(BaseModel):
    title: str
    projectId: Optional[int] = 1
    assignee: Optional[str] = "Maya Chen"
    stage: Optional[str] = "Execution"
    priority: Optional[str] = "medium"
    estimatedHours: Optional[float] = 4.0
    actualHours: Optional[float] = 0.0
    dueAt: Optional[str] = None

class ProjectCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    ownerName: Optional[str] = "Maya Chen"
    progress: Optional[int] = 0
    status: Optional[str] = "active"
    dueAt: Optional[str] = None

# Workforce
class EmployeeCreateRequest(BaseModel):
    name: str
    email: str
    department: str
    roleTitle: str
    skills: str
    capacityHours: Optional[int] = 40
    role: Optional[str] = "employee"

class EmployeeRoleUpdateRequest(BaseModel):
    role: str

class ScheduleCreateRequest(BaseModel):
    employeeId: int
    date: str
    startTime: str
    endTime: str
    type: str
    note: Optional[str] = ""

class InvitationCreateRequest(BaseModel):
    email: str
    role: str
    department: str
    roleTitle: Optional[str] = ""

# Workflows
class WorkflowGenerateRequest(BaseModel):
    prompt: str

class WorkflowCreateRequest(BaseModel):
    name: str
    trigger: str
    stages: List[str]
    description: Optional[str] = ""

# Decision Simulator
class SimulatorCompareRequest(BaseModel):
    interventionType: str = Field(..., description="e.g. reassign_task, extend_deadline, rebalance_capacity, reduce_scope")
    taskId: Optional[int] = None
    targetAssignee: Optional[str] = None
    priorityChange: Optional[str] = None
    scheduleAdjustmentHours: Optional[float] = 0.0
    notes: Optional[str] = ""

# Business Copilot
class CopilotAskRequest(BaseModel):
    question: str
    context: Optional[Dict[str, Any]] = None

# Outcome Learning
class OutcomeRecordRequest(BaseModel):
    recommendationId: Optional[int] = None
    interventionType: str
    actionTaken: str = Field(..., description="accepted, rejected, modified")
    decisionMaker: Optional[str] = "Current User"
    predictedRiskDelta: Optional[float] = 0.0
    actualOutcomeObserved: Optional[str] = ""
    actualDelayHours: Optional[float] = 0.0
    notes: Optional[str] = ""
