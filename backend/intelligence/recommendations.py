import json
import logging
from typing import List, Dict, Any, Optional
import httpx

from backend.core.config import settings
from backend.intelligence.predictions import calculate_predictions
from backend.intelligence.workload import calculate_workload

logger = logging.getLogger("bussologic.recommendations")

async def generate_recommendations(tasks: List[Dict[str, Any]], employees: List[Dict[str, Any]]) -> Dict[str, Any]:
    predictions = calculate_predictions(tasks, employees)
    workload = calculate_workload(employees, tasks)
    
    overloaded = [w for w in workload if w["loadBand"] == "overloaded"]
    underused = [w for w in workload if w["loadBand"] == "underused"]
    high_risk_tasks = [p for p in predictions if p["probability"] >= 55]

    deterministic_recs: List[Dict[str, Any]] = []

    # 1. Capacity rebalancing recommendation if overloaded & underused exist
    if overloaded and underused:
        src = overloaded[0]
        tgt = underused[0]
        # find tasks assigned to src
        src_tasks = [t for t in tasks if t.get("assignee") == src["name"] and t.get("status") != "done"]
        task_name = src_tasks[0]["title"] if src_tasks else "active workload"
        task_id = src_tasks[0]["id"] if src_tasks else 1
        
        deterministic_recs.append({
            "id": 1,
            "title": f"Rebalance operational capacity from {src['name']} to {tgt['name']}",
            "detail": f"{tgt['name']} has capacity ({tgt['plannedHours']}h / {tgt['capacityHours']}h) to absorb '{task_name}' and relieve {src['name']} ({src['utilization']}% utilization).",
            "type": "capacity",
            "confidence": 94,
            "source": "rules",
            "targetTaskId": task_id,
            "targetAssignee": tgt["name"],
            "expectedBenefit": f"Lowers {src['name']}'s utilization to ~75%, eliminates bottlenecks, and protects project milestone.",
            "evidence": f"{src['name']} is at {src['utilization']}% utilization across {src['assignedTasks']} tasks; {tgt['name']} is at {tgt['utilization']}% utilization.",
            "alternatives": "Postpone task deadline by 3 days, or descope secondary acceptance criteria.",
            "uncertainty": "Requires brief handoff context between team members."
        })

    # 2. Blocked / high risk task escalation
    blocked_tasks = [t for t in tasks if t.get("status") == "blocked"]
    if blocked_tasks:
        b = blocked_tasks[0]
        pred_match = next((p for p in predictions if p["taskId"] == b["id"]), None)
        prob = pred_match["probability"] if pred_match else 78
        deterministic_recs.append({
            "id": 2,
            "title": f"Unblock critical path: '{b['title']}'",
            "detail": f"Task #{b['id']} has been blocked with critical priority, driving a {prob}% delay risk on the active sprint.",
            "type": "risk",
            "confidence": prob,
            "source": "rules",
            "targetTaskId": b["id"],
            "targetAssignee": b.get("assignee"),
            "expectedBenefit": "Resolves dependency stall and saves up to 48 hours of cascading milestone delay.",
            "evidence": f"Task #{b['id']} is marked blocked with priority {b.get('priority')} and {b.get('actualHours', 0)}h logged against {b.get('estimatedHours', 0)}h estimated.",
            "alternatives": "Reassign to program lead for fast-track managerial signoff.",
            "uncertainty": "Depends on third-party response time."
        })
    elif high_risk_tasks:
        hr = high_risk_tasks[0]
        deterministic_recs.append({
            "id": 2,
            "title": f"Mitigate delivery slip for '{hr['taskTitle']}'",
            "detail": f"Task #{hr['taskId']} is trending at {hr['probability']}% delay likelihood due to: {', '.join(hr['drivers'])}.",
            "type": "risk",
            "confidence": hr["probability"],
            "source": "rules",
            "targetTaskId": hr["taskId"],
            "targetAssignee": hr["assignee"],
            "expectedBenefit": "Restores buffer margin before planned deadline.",
            "evidence": f"Drivers: {', '.join(hr['drivers']) if hr['drivers'] else 'tight deadline and load'}.",
            "alternatives": "Pair assignee with a peer specialist for rapid review.",
            "uncertainty": "Minor ramp-up overhead."
        })

    # 3. Schedule alignment
    if len(deterministic_recs) < 3 and tasks:
        overdue_or_soon = [t for t in tasks if t.get("status") != "done" and t.get("priority") in ("high", "critical")]
        if overdue_or_soon:
            sample = overdue_or_soon[0]
            deterministic_recs.append({
                "id": 3,
                "title": f"Review sprint allocation for {sample.get('assignee', 'team')}",
                "detail": f"Maintain daily check-in cadence on high-priority deliverable '{sample.get('title')}'.",
                "type": "optimization",
                "confidence": 85,
                "source": "rules",
                "targetTaskId": sample.get("id"),
                "targetAssignee": sample.get("assignee"),
                "expectedBenefit": "Prevents late-stage surprise slips.",
                "evidence": f"Priority is {sample.get('priority')}, scheduled for stage '{sample.get('stage')}'.",
                "alternatives": "Convert to asynchronous checkpoint updates.",
                "uncertainty": "Low."
            })

    # If LLM is not enabled, return deterministic
    if not settings.ENABLE_LLM or not settings.LLM_API_KEY:
        return {
            "source": "rules",
            "recommendations": deterministic_recs,
            "note": "Deterministic operational intelligence active. Set ENABLE_LLM=true & LLM_API_KEY for dynamic LLM reasoning."
        }

    # Optional LLM call if configured
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            prompt = (
                f"You are BUSSOLOGIC Operations Copilot. Analyze this operational workload and return recommendations.\n"
                f"Tasks: {json.dumps(tasks[:8])}\n"
                f"Workload: {json.dumps(workload)}\n"
                f"Predictions: {json.dumps(predictions[:5])}\n"
                "Return valid JSON with key 'recommendations' containing list of objects: "
                "[{'id': int, 'title': str, 'detail': str, 'type': 'capacity'|'risk'|'optimization', 'confidence': int, "
                "'expectedBenefit': str, 'evidence': str, 'alternatives': str, 'uncertainty': str}]"
            )
            response = await client.post(
                f"{settings.LLM_API_URL.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"},
                json={
                    "model": settings.LLM_MODEL,
                    "messages": [
                        {"role": "system", "content": "You are BUSSOLOGIC, an enterprise operations intelligence system. Return JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"}
                }
            )
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                recs = parsed.get("recommendations", deterministic_recs)
                for r in recs:
                    r["source"] = settings.LLM_MODEL
                return {
                    "source": settings.LLM_MODEL,
                    "recommendations": recs,
                    "note": f"Enriched with {settings.LLM_MODEL} reasoning."
                }
    except Exception as e:
        logger.warning("LLM call failed (%s), returning deterministic recommendations.", str(e))

    return {
        "source": "rules",
        "recommendations": deterministic_recs,
        "note": "Deterministic operational intelligence fallback used."
    }
