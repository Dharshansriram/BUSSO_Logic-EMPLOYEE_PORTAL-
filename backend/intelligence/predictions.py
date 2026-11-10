import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

def clamp(val: float, min_val: float = 0, max_val: float = 99) -> int:
    return max(int(min_val), min(int(max_val), round(val)))

def level_for(prob: float) -> str:
    if prob >= 75:
        return "critical"
    if prob >= 55:
        return "high"
    if prob >= 30:
        return "medium"
    return "low"

def parse_iso(dt_str: Any) -> Optional[datetime]:
    if not dt_str:
        return None
    if isinstance(dt_str, datetime):
        return dt_str
    try:
        clean = str(dt_str).replace("Z", "+00:00")
        return datetime.fromisoformat(clean)
    except Exception:
        return None

def calculate_predictions(tasks: List[Dict[str, Any]], employees: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    # Map planned hours per employee
    emp_load: Dict[str, Dict[str, float]] = {
        emp["name"]: {"planned": 0.0, "capacity": float(emp.get("capacityHours") or 40)}
        for emp in employees
    }
    
    for task in tasks:
        assignee = task.get("assignee")
        if assignee in emp_load and task.get("status") != "done":
            emp_load[assignee]["planned"] += float(task.get("estimatedHours") or 4.0)

    now = datetime.now(timezone.utc)
    predictions = []

    for task in tasks:
        if task.get("status") == "done":
            continue
        
        assignee = task.get("assignee", "Unassigned")
        load = emp_load.get(assignee, {"planned": 0.0, "capacity": 40.0})
        
        due_at = parse_iso(task.get("dueAt"))
        if due_at:
            if due_at.tzinfo is None:
                due_at = due_at.replace(tzinfo=timezone.utc)
            hours_to_due = (due_at.timestamp() - now.timestamp()) / 3600.0
        else:
            hours_to_due = 48.0

        drivers = []
        blocked = 1.0 if task.get("status") == "blocked" else 0.0
        p_raw = task.get("priority", "medium")
        priority = 1.0 if p_raw == "critical" else (0.7 if p_raw == "high" else 0.0)
        urgent = 1.0 if hours_to_due < 0 else (0.65 if hours_to_due < 24 else 0.0)
        
        est = float(task.get("estimatedHours") or 4.0)
        act = float(task.get("actualHours") or 0.0)
        overrun = min(1.0, max(0.0, (act - est) / max(1.0, est)))
        
        cap = max(1.0, load["capacity"])
        planned_ratio = load["planned"] / cap
        overload = min(1.5, max(0.0, planned_ratio - 0.65))

        if blocked > 0:
            drivers.append("task is blocked")
        if priority > 0:
            drivers.append(f"{p_raw} priority")
        if urgent > 0:
            drivers.append("deadline has passed" if hours_to_due < 0 else "deadline is within 24 hours")
        if overrun > 0:
            drivers.append("actual effort is above estimate")
        if overload > 0:
            drivers.append(f"{assignee} is above 85% planned capacity")

        # Logistic regression formula: sigmoid(intercept + weighted features)
        logit = -2.15 + (1.45 * blocked) + (1.05 * priority) + (1.35 * urgent) + (1.1 * overrun) + (1.25 * overload)
        sigmoid_val = 1.0 / (1.0 + math.exp(-logit))
        probability = clamp(sigmoid_val * 100.0)
        risk_level = level_for(probability)

        rec_action = (
            f"Reassign or add support for {assignee} before the next checkpoint."
            if probability >= 55
            else "Keep the current plan and check progress at the next update."
        )

        predictions.append({
            "taskId": task.get("id"),
            "taskTitle": task.get("title"),
            "assignee": assignee,
            "probability": probability,
            "riskLevel": risk_level,
            "drivers": drivers,
            "recommendedAction": rec_action,
            "modelVersion": "logistic-v1-explainable",
            "source": "rules"
        })

    predictions.sort(key=lambda x: x["probability"], reverse=True)
    return predictions
