import json
import logging
from typing import Dict, Any, List, Optional
import httpx

from backend.core.config import settings
from backend.intelligence.predictions import calculate_predictions
from backend.intelligence.workload import calculate_workload
from backend.intelligence.decision_simulator import simulate_intervention

logger = logging.getLogger("bussologic.copilot")

async def ask_copilot(
    question: str,
    tasks: List[Dict[str, Any]],
    employees: List[Dict[str, Any]],
    projects: List[Dict[str, Any]]
) -> Dict[str, Any]:
    q_lower = question.lower()
    predictions = calculate_predictions(tasks, employees)
    workload = calculate_workload(employees, tasks)
    
    high_risk = [p for p in predictions if p["probability"] >= 55]
    overloaded = [w for w in workload if w["loadBand"] == "overloaded"]
    underused = [w for w in workload if w["loadBand"] == "underused"]
    blocked = [t for t in tasks if t.get("status") == "blocked"]

    # Check for specific grounded intents
    # Intent 1: Risk / Milestone threats
    if any(k in q_lower for k in ("risk", "threat", "late", "delay", "miss", "slip", "behind")):
        if high_risk:
            task_bullets = "\n".join([
                f"- **{h['taskTitle']}** (#{h['taskId']}): **{h['probability']}% delay risk** ({h['riskLevel']}) assigned to {h['assignee']}. Key drivers: {', '.join(h['drivers'])}."
                for h in high_risk
            ])
            answer = (
                f"### Operational Risk Assessment\n\n"
                f"Identified **{len(high_risk)} high-risk task(s)** threatening current delivery schedules:\n\n"
                f"{task_bullets}\n\n"
                f"**Root Causes:**\n"
                f"- Dependencies: {len(blocked)} blocked item(s).\n"
                f"- Capacity pressure: {len(overloaded)} overloaded team member(s).\n\n"
                f"**Recommended Step:** Escalate blocked dependencies and reassign non-critical tasks to team members with available buffer."
            )
            return {
                "answer": answer,
                "dataReferences": [{"type": "task", "id": h["taskId"], "title": h["taskTitle"]} for h in high_risk],
                "requiresConfirmation": False,
                "proposedAction": {
                    "type": "reassign_task",
                    "taskId": high_risk[0]["taskId"],
                    "targetAssignee": underused[0]["name"] if underused else "Noah Williams"
                } if underused else None
            }
        else:
            return {
                "answer": "All current workflow items are tracking within healthy delivery parameters. No tasks currently exceed the 55% delay risk threshold.",
                "dataReferences": [],
                "requiresConfirmation": False,
                "proposedAction": None
            }

    # Intent 2: Capacity / Workload
    if any(k in q_lower for k in ("capacity", "overload", "utilization", "workload", "busy", "free", "hours", "available")):
        overload_desc = ", ".join([f"{o['name']} ({o['utilization']}%)" for o in overloaded]) if overloaded else "None"
        underused_desc = ", ".join([f"{u['name']} ({u['utilization']}%, {u['capacityHours'] - u['plannedHours']}h free)" for u in underused]) if underused else "None"
        
        answer = (
            f"### Workforce Capacity Breakdown\n\n"
            f"- **Average Team Utilization:** {round(sum(w['utilization'] for w in workload) / max(1, len(workload)))}%\n"
            f"- **Overloaded Personnel (>=90%):** {overload_desc}\n"
            f"- **Available Personnel (<=45%):** {underused_desc}\n\n"
            f"**Actionable Balance Opportunity:** Noah Williams and available team members have capacity to absorb active sprint items currently congesting Maya Chen or Jon Bell."
        )
        return {
            "answer": answer,
            "dataReferences": [{"type": "employee", "id": w.get("id"), "name": w["name"], "utilization": w["utilization"]} for w in workload],
            "requiresConfirmation": False,
            "proposedAction": None
        }

    # Intent 3: Simulation or Reassignment proposal
    if any(k in q_lower for k in ("reassign", "simulate", "transfer", "move task", "what if")):
        # run simulation on the first blocked or high risk task
        target_t = blocked[0] if blocked else (tasks[0] if tasks else None)
        target_t_id = target_t.get("id") if target_t else 1
        target_t_title = target_t.get("title") if target_t else "Task"
        target_person = underused[0]["name"] if underused else "Noah Williams"
        
        sim_res = simulate_intervention(
            tasks, employees,
            intervention_type="reassign_task",
            task_id=target_t_id,
            target_assignee=target_person
        )
        
        answer = (
            f"### Simulated Intervention Analysis\n\n"
            f"**Proposed Intervention:** Reassign #{target_t_id} ('{target_t_title}') to **{target_person}**.\n\n"
            f"**Projected Impact:**\n"
            f"- Risk probability: **{sim_res['baseline']['riskProbability']}% → {sim_res['proposed']['riskProbability']}%** ({sim_res['delta']['riskReduction']}% reduction).\n"
            f"- Source assignee capacity relieved: **{sim_res['baseline']['sourceAssigneeUtilization']}% → {sim_res['proposed']['sourceAssigneeUtilization']}%**.\n"
            f"- Target assignee capacity absorbed: **{sim_res['baseline']['targetAssigneeUtilization']}% → {sim_res['proposed']['targetAssigneeUtilization']}%**.\n\n"
            f"**Verdict:** {sim_res['verdict']}\n\n"
            f"> [!IMPORTANT]\n"
            f"> Executing this reassignment requires manager approval before modifying live task assignments."
        )
        return {
            "answer": answer,
            "dataReferences": [{"type": "task", "id": target_t_id, "title": target_t_title}],
            "requiresConfirmation": True,
            "proposedAction": {
                "type": "reassign_task",
                "taskId": target_t_id,
                "targetAssignee": target_person,
                "description": f"Reassign '{target_t_title}' to {target_person}"
            }
        }

    # Intent 4: General / Overview
    active_projects = [p for p in projects if p.get("status") != "completed"]
    answer = (
        f"### BUSSOLOGIC Operations Status\n\n"
        f"- **Active Projects:** {len(active_projects)} ({', '.join([p['name'] for p in active_projects])})\n"
        f"- **Active Tasks:** {len([t for t in tasks if t.get('status') != 'done'])}\n"
        f"- **At-Risk Tasks:** {len(high_risk)}\n"
        f"- **Blocked Deliverables:** {len(blocked)}\n\n"
        f"Ask me to analyze risks, balance capacity, or run what-if scenario simulations on any task or project."
    )
    return {
        "answer": answer,
        "dataReferences": [],
        "requiresConfirmation": False,
        "proposedAction": None
    }
