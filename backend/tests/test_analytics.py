import asyncio
from backend.core.demo_data import DEMO_TASKS, DEMO_EMPLOYEES
from backend.intelligence.predictions import calculate_predictions
from backend.intelligence.workload import calculate_workload
from backend.intelligence.recommendations import generate_recommendations
from backend.ml.pipeline import train_and_evaluate_model, predict_single

def test_predictions_calculation():
    predictions = calculate_predictions(DEMO_TASKS, DEMO_EMPLOYEES)
    assert len(predictions) > 0
    top = predictions[0]
    assert "probability" in top
    assert 0 <= top["probability"] <= 99
    assert "riskLevel" in top
    assert "drivers" in top
    # Task 3 is blocked and critical, so should have high probability
    t3 = next((p for p in predictions if p["taskId"] == 3), None)
    assert t3 is not None
    assert t3["probability"] >= 50

def test_workload_calculation():
    workload = calculate_workload(DEMO_EMPLOYEES, DEMO_TASKS)
    assert len(workload) == len(DEMO_EMPLOYEES)
    for emp in workload:
        assert "utilization" in emp
        assert "loadBand" in emp
        assert emp["loadBand"] in ("overloaded", "underused", "balanced")

def test_recommendations_generation():
    res = asyncio.run(generate_recommendations(DEMO_TASKS, DEMO_EMPLOYEES))
    assert "recommendations" in res
    assert len(res["recommendations"]) >= 1
    rec = res["recommendations"][0]
    assert "title" in rec
    assert "expectedBenefit" in rec
    assert "evidence" in rec

def test_ml_pipeline_train_evaluate():
    metrics = train_and_evaluate_model()
    assert "f1Score" in metrics
    assert metrics["f1Score"] >= 65.0
    assert metrics["accuracy"] >= 65.0
    
    pred = predict_single({
        "blocked": 1.0,
        "priority_score": 1.0,
        "urgency_score": 1.0,
        "overrun_ratio": 0.5,
        "overload_ratio": 0.8
    })
    assert pred["delayProbability"] >= 50
