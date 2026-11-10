import os
import sys

# Ensure both bisso_project root and backend directory are in Python's search path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_current_dir)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import settings
from backend.core.database import get_db, ensure_seed, mongo_status
from backend.ml.pipeline import get_ml_metrics

from backend.routers.auth import router as auth_router
from backend.routers.dashboard import router as dashboard_router
from backend.routers.tasks import router as tasks_router
from backend.routers.projects import router as projects_router
from backend.routers.people import router as people_router
from backend.routers.analytics import router as analytics_router
from backend.routers.workflows import router as workflows_router
from backend.routers.simulator import router as simulator_router
from backend.routers.copilot import router as copilot_router
from backend.routers.outcomes import router as outcomes_router
from backend.routers.audit import router as audit_router
from backend.routers.events import router as events_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("bussologic")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing BUSSOLOGIC Operations Intelligence Platform...")
    try:
        await get_db()
        await ensure_seed()
    except Exception as e:
        logger.warning("Database startup notice: %s", str(e))
    
    try:
        metrics = get_ml_metrics()
        logger.info("Operational ML pipeline initialized: F1 score %s%%", metrics.get("f1Score"))
    except Exception as e:
        logger.warning("ML initialization notice: %s", str(e))
        
    yield
    logger.info("Shutting down BUSSOLOGIC.")

app = FastAPI(
    title="BUSSOLOGIC — AI-Powered Business Operations Intelligence Platform",
    description="Operational risk prediction, decision simulation, and automated outcomes API.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes (prefixed with /api to match client proxy)
api_prefix = "/api"
app.include_router(auth_router, prefix=api_prefix)
app.include_router(dashboard_router, prefix=api_prefix)
app.include_router(tasks_router, prefix=api_prefix)
app.include_router(projects_router, prefix=api_prefix)
app.include_router(people_router, prefix=api_prefix)
app.include_router(analytics_router, prefix=api_prefix)
app.include_router(workflows_router, prefix=api_prefix)
app.include_router(simulator_router, prefix=api_prefix)
app.include_router(copilot_router, prefix=api_prefix)
app.include_router(outcomes_router, prefix=api_prefix)
app.include_router(audit_router, prefix=api_prefix)
app.include_router(events_router, prefix=api_prefix)

@app.get("/api/health")
async def health_check():
    await get_db()
    return {
        "status": "healthy",
        "storage": mongo_status(),
        "platform": "BUSSOLOGIC",
        "version": "1.0.0",
        "capabilities": [
            "predictive_risk_radar",
            "capacity_intelligence",
            "decision_simulator",
            "recommendation_engine",
            "business_copilot",
            "outcome_learning",
            "workflow_builder",
            "governance_audit"
        ]
    }

@app.get("/")
async def root():
    return {
        "name": "BUSSOLOGIC API",
        "documentation": "/docs",
        "health": "/api/health"
    }

if __name__ == "__main__":
    import uvicorn
    # Determine import path depending on working directory
    is_in_backend = os.path.basename(os.getcwd()) == "backend"
    app_target = "main:app" if is_in_backend else "backend.main:app"
    uvicorn.run(app_target, host=settings.HOST, port=settings.PORT, reload=True)
