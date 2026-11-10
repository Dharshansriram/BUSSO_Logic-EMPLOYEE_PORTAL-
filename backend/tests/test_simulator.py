import pytest
from backend.core.demo_data import DEMO_TASKS, DEMO_EMPLOYEES
from backend.intelligence.decision_simulator import simulate_intervention

def test_decision_simulator_reassign():
    res = simulate_intervention(
        tasks=DEMO_TASKS,
        employees=DEMO_EMPLOYEES,
        intervention_type="reassign_task",
        task_id=3,
        target_assignee="Noah Williams"
    )
    assert "baseline" in res
    assert "proposed" in res
    assert "delta" in res
    assert "verdict" in res
    assert res["proposed"]["targetAssigneeUtilization"] >= res["baseline"]["targetAssigneeUtilization"]

def test_decision_simulator_extend_deadline():
    res = simulate_intervention(
        tasks=DEMO_TASKS,
        employees=DEMO_EMPLOYEES,
        intervention_type="extend_deadline",
        task_id=1,
        schedule_adjustment_hours=72.0
    )
    assert "delta" in res
    assert res["delta"]["riskReduction"] >= 0
