from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def future_iso(hours: float) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()

def past_iso(hours: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

DEMO_PROJECTS: List[Dict[str, Any]] = [
    {
        "id": 1,
        "name": "Customer onboarding",
        "description": "Automate the new customer journey from contract to go-live.",
        "status": "active",
        "progress": 68,
        "ownerName": "Maya Chen",
        "dueAt": future_iso(96),
        "createdAt": now_iso(),
        "updatedAt": now_iso()
    },
    {
        "id": 2,
        "name": "Q4 hiring sprint",
        "description": "Coordinate interviews, approvals, and onboarding for priority roles.",
        "status": "at_risk",
        "progress": 42,
        "ownerName": "Jon Bell",
        "dueAt": future_iso(48),
        "createdAt": now_iso(),
        "updatedAt": now_iso()
    },
    {
        "id": 3,
        "name": "Security review",
        "description": "Close the access review and evidence collection workflow.",
        "status": "active",
        "progress": 81,
        "ownerName": "Ari Singh",
        "dueAt": future_iso(216),
        "createdAt": now_iso(),
        "updatedAt": now_iso()
    }
]

DEMO_TASKS: List[Dict[str, Any]] = [
    {
        "id": 1,
        "projectId": 1,
        "title": "Verify legal documents",
        "assignee": "Maya Chen",
        "stage": "Document review",
        "status": "in_progress",
        "priority": "high",
        "dueAt": future_iso(7),
        "estimatedHours": 8,
        "actualHours": 5,
        "createdAt": now_iso(),
        "updatedAt": now_iso()
    },
    {
        "id": 2,
        "projectId": 1,
        "title": "Schedule implementation call",
        "assignee": "Noah Williams",
        "stage": "Kickoff",
        "status": "todo",
        "priority": "medium",
        "dueAt": future_iso(23),
        "estimatedHours": 4,
        "actualHours": 0,
        "createdAt": now_iso(),
        "updatedAt": now_iso()
    },
    {
        "id": 3,
        "projectId": 2,
        "title": "Panel feedback collection",
        "assignee": "Jon Bell",
        "stage": "Interview loop",
        "status": "blocked",
        "priority": "critical",
        "dueAt": future_iso(5),
        "estimatedHours": 6,
        "actualHours": 8,
        "createdAt": now_iso(),
        "updatedAt": now_iso()
    },
    {
        "id": 4,
        "projectId": 3,
        "title": "Access evidence export",
        "assignee": "Ari Singh",
        "stage": "Evidence",
        "status": "done",
        "priority": "low",
        "dueAt": past_iso(6),
        "estimatedHours": 5,
        "actualHours": 4,
        "createdAt": now_iso(),
        "updatedAt": now_iso()
    }
]

DEMO_EMPLOYEES: List[Dict[str, Any]] = [
    {
        "id": 1,
        "name": "Maya Chen",
        "email": "maya@acme.test",
        "role": "manager",
        "department": "Customer Success",
        "roleTitle": "Implementation Lead",
        "capacityHours": 40,
        "availability": "partial",
        "skills": "onboarding, compliance, customer success",
        "managerName": "Ari Singh",
        "createdAt": now_iso()
    },
    {
        "id": 2,
        "name": "Noah Williams",
        "email": "noah@acme.test",
        "role": "employee",
        "department": "Customer Success",
        "roleTitle": "Implementation Specialist",
        "capacityHours": 40,
        "availability": "available",
        "skills": "onboarding, training, integrations",
        "managerName": "Maya Chen",
        "createdAt": now_iso()
    },
    {
        "id": 3,
        "name": "Jon Bell",
        "email": "jon@acme.test",
        "role": "manager",
        "department": "People Operations",
        "roleTitle": "Recruiting Manager",
        "capacityHours": 32,
        "availability": "available",
        "skills": "recruiting, interviews, sourcing",
        "managerName": "Ari Singh",
        "createdAt": now_iso()
    },
    {
        "id": 4,
        "name": "Ari Singh",
        "email": "ari@acme.test",
        "role": "admin",
        "department": "Security",
        "roleTitle": "Security Program Manager",
        "capacityHours": 40,
        "availability": "available",
        "skills": "security, audits, risk",
        "managerName": "Maya Chen",
        "createdAt": now_iso()
    }
]

today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

DEMO_SCHEDULES: List[Dict[str, Any]] = [
    {
        "id": 1,
        "employeeId": 1,
        "date": today_str,
        "startTime": "09:00",
        "endTime": "17:00",
        "type": "work",
        "note": "Customer onboarding coverage",
        "createdAt": now_iso()
    },
    {
        "id": 2,
        "employeeId": 1,
        "date": today_str,
        "startTime": "13:00",
        "endTime": "14:00",
        "type": "meeting",
        "note": "Weekly implementation review",
        "createdAt": now_iso()
    },
    {
        "id": 3,
        "employeeId": 2,
        "date": today_str,
        "startTime": "09:00",
        "endTime": "17:00",
        "type": "work",
        "note": "Available for reassignment",
        "createdAt": now_iso()
    },
    {
        "id": 4,
        "employeeId": 3,
        "date": today_str,
        "startTime": "10:00",
        "endTime": "16:00",
        "type": "focus",
        "note": "Interview loop",
        "createdAt": now_iso()
    }
]

DEMO_RECOMMENDATIONS: List[Dict[str, Any]] = [
    {
        "id": 1,
        "title": "Rebalance the onboarding queue",
        "detail": "Noah has capacity to absorb the implementation call and protect the Friday milestone.",
        "type": "capacity",
        "confidence": 94,
        "source": "rules",
        "expectedBenefit": "Reduces Maya's load from 96% to 74% and cuts delivery delay probability by 28%.",
        "evidence": "Noah planned hours: 4h / 40h (10% utilization). Maya planned hours: 38h / 40h (95% utilization).",
        "alternatives": "Postpone onboarding kickoff by 48h, or bring in contract specialist.",
        "createdAt": now_iso()
    },
    {
        "id": 2,
        "title": "Escalate panel feedback",
        "detail": "The hiring sprint is trending behind plan. Ask the panel lead for feedback before 16:00.",
        "type": "risk",
        "confidence": 87,
        "source": "rules",
        "expectedBenefit": "Unblocks task #3 and avoids 2-day candidate offer delay.",
        "evidence": "Task #3 has been marked 'blocked' for 8 hours with critical priority.",
        "alternatives": "Re-run candidate loop or waive panel approval requirement.",
        "createdAt": now_iso()
    }
]

DEMO_ALERTS: List[Dict[str, Any]] = [
    {
        "id": 1,
        "title": "Task likely to miss deadline",
        "detail": "Panel feedback collection has a 78% delay probability.",
        "severity": "critical",
        "projectName": "Q4 hiring sprint",
        "resolved": 0,
        "createdAt": past_iso(0.35)
    },
    {
        "id": 2,
        "title": "Workload imbalance detected",
        "detail": "Maya is at 96% capacity across active workflows.",
        "severity": "warning",
        "projectName": "Customer onboarding",
        "resolved": 0,
        "createdAt": past_iso(0.7)
    }
]

DEMO_ACTIVITY: List[Dict[str, Any]] = [
    {
        "id": 1,
        "actor": "Maya Chen",
        "action": "completed",
        "entity": "Security evidence export",
        "createdAt": past_iso(0.2)
    },
    {
        "id": 2,
        "actor": "AI assistant",
        "action": "flagged a risk in",
        "entity": "Q4 hiring sprint",
        "createdAt": past_iso(0.5)
    },
    {
        "id": 3,
        "actor": "Jon Bell",
        "action": "updated",
        "entity": "Panel feedback collection",
        "createdAt": past_iso(0.7)
    }
]

# Fallback in-memory stores
fallback_sessions: Dict[str, Dict[str, Any]] = {}
fallback_reset_tokens: Dict[str, Dict[str, Any]] = {}
fallback_audit: List[Dict[str, Any]] = []
fallback_invitations: List[Dict[str, Any]] = []
fallback_notifications: List[Dict[str, Any]] = []
fallback_simulations: List[Dict[str, Any]] = []
fallback_outcomes: List[Dict[str, Any]] = []
fallback_workflows: List[Dict[str, Any]] = [
    {
        "id": 1,
        "name": "Customer Onboarding Streamlined",
        "trigger": "contract_signed",
        "stages": ["Intake & approval", "Document verification", "Technical kickoff", "Final confirmation"],
        "status": "active",
        "createdAt": now_iso()
    }
]
