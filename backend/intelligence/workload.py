from typing import List, Dict, Any

def clamp(val: float, min_val: float = 0, max_val: float = 150) -> int:
    return max(int(min_val), min(int(max_val), round(val)))

def calculate_workload(employees: List[Dict[str, Any]], tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    result = []
    for emp in employees:
        emp_name = emp.get("name")
        assigned = [t for t in tasks if t.get("assignee") == emp_name and t.get("status") != "done"]
        
        planned_hours = sum(float(t.get("estimatedHours") or 4.0) for t in assigned)
        cap = float(emp.get("capacityHours") or 40.0)
        
        utilization = clamp((planned_hours / max(1.0, cap)) * 100.0, 0, 150)
        
        if assigned and planned_hours > 0:
            excess_effort = sum(
                max(0.0, float(t.get("actualHours") or 0.0) - float(t.get("estimatedHours") or 4.0))
                for t in assigned
            )
            efficiency = max(0, min(100, round(100.0 - (excess_effort / max(1.0, planned_hours)) * 100.0)))
        else:
            efficiency = 100
        
        if utilization >= 90:
            load_band = "overloaded"
        elif utilization <= 45:
            load_band = "underused"
        else:
            load_band = "balanced"
            
        emp_copy = dict(emp)
        if "passwordHash" in emp_copy:
            del emp_copy["passwordHash"]
            
        emp_copy.update({
            "assignedTasks": len(assigned),
            "plannedHours": round(planned_hours, 1),
            "utilization": utilization,
            "efficiency": efficiency,
            "loadBand": load_band
        })
        result.append(emp_copy)
        
    return result
