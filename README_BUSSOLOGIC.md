pip # BUSSOLOGIC — AI-Powered Business Operations Intelligence Platform

> **Predict Risks. Optimize Decisions. Automate Outcomes.**

BUSSOLOGIC transforms conventional task-tracking and manual operations management into a connected intelligence system. Predictions lead to decisions, decisions lead to counterfactual simulation, simulations lead to controlled automated workflows, and observed real-world outcomes are measured to close the feedback loop.

---

## 🚀 Key Modules & Architecture

```
bisso_project/
├── backend/                         # Python FastAPI Operations Intelligence Kernel
│   ├── core/                        # Configuration, async DB (Motor), and session auth
│   ├── models/                      # Pydantic schemas and database models
│   ├── intelligence/                # Delay predictions, capacity math, and grounded copilot
│   ├── ml/                          # Scikit-learn training pipeline, F1 metrics, model registry
│   ├── routers/                     # 12 Modular REST & SSE endpoints
│   └── tests/                       # Pytest test suite for auth, analytics, and simulator
├── client/                          # React + Vite Enterprise Control Plane
│   └── src/
│       ├── components/              # Sidebar, modals, drawers, and metric cards
│       ├── pages/                   # 12 Dedicated module views (Radar, Simulator, etc.)
│       ├── lib/api.js               # Centralized fetch API client
│       └── bussologic.css           # Modern Enterprise Design System
├── vite.config.ts                   # Proxies /api requests to FastAPI on port 8000
└── package.json                     # Monorepo scripts
```

### The 9 Core Modules

1. **Operations Overview (Dashboard)**: Executive view of delivery health, active workflows, priority alerts, and pending deliverables with live sync.
2. **Predictive Risk Radar (Module B)**: Transparent logistic delay probability scoring with explainable driver breakdown (e.g., blocked status, overruns, capacity saturation) and scikit-learn model metrics.
3. **Capacity Intelligence (Module C)**: Real-time workforce capacity tracking, load bands (*overloaded*, *balanced*, *underused*), efficiency calculations, schedule exports, and burnout prevention.
4. **Decision Simulator (Module D)**: Counterfactual "what-if" intervention engine. Compares hypothetical interventions (task reassignments, deadline extensions, scope reductions) against baseline production without mutating live database state.
5. **Ranked Corrective Recommendations (Module E)**: Actionable interventions citing verifiable database evidence, quantified expected benefits, and alternative choices.
6. **Workflow Builder & Automation (Module F)**: Natural language prompt-based blueprint generation and visual pipeline execution for multi-stage processes.
7. **Business Copilot (Module G)**: Conversational assistant grounded strictly in actual database records with human-in-the-loop safety confirmation before state modification.
8. **Outcome Learning & Telemetry (Module H)**: Closed-loop telemetry tracking decision acceptance rates, comparing predicted risk delta against observed results.
9. **Governance & Audit Monitor (Module I)**: Immutable audit logging of all state mutations, schedule updates, and simulation executions.

---

## 🛠️ Quickstart Guide

### Prerequisites
- Python 3.11+ (Python 3.15 supported)
- Node.js 18+ and `pnpm` (or `npm`)
- MongoDB (Optional: BUSSOLOGIC automatically runs in full in-memory fallback mode with complete seeded demo data if MongoDB is unavailable)

### 1. Install Backend Dependencies
```bash
pip install -r backend/requirements.txt
```

### 2. Install Frontend Dependencies
```bash
pnpm install
```

### 3. Start the Platform
In one terminal, start the FastAPI backend:
```bash
python -m uvicorn backend.main:app --reload --port 8000
```

In a second terminal, start the Vite frontend:
```bash
pnpm run dev
```

Navigate to `http://localhost:5173` in your browser.

---

## 🔐 Pre-Seeded Demo Credentials

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Manager** | `maya@acme.test` | `Welcome123!` | Full operations access, simulation, workflow generation |
| **Admin** | `ari@acme.test` | `Welcome123!` | Full access + role management & administrative audits |
| **Employee** | `noah@acme.test` | `Welcome123!` | Task updates, individual schedule view |

---

## 🧪 Running Automated Tests

Run backend unit and integration tests:
```bash
pytest backend/tests -v
```

Tests cover:
- Password scrypt hashing & compatibility
- Delay prediction algorithm & explainable drivers
- Capacity & workload utilization math
- Decision simulator counterfactual comparison
- Machine learning pipeline F1 score (>65% requirement)

---

## 📡 API Reference Summary

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/login` | POST | Authenticates employee & sets session cookie |
| `/api/auth/me` | GET | Returns authenticated user profile |
| `/api/dashboard` | GET | Returns projects, tasks, alerts, and recommendations |
| `/api/analytics/predictions` | GET | Returns delay probabilities & ML model metrics |
| `/api/analytics/workload` | GET | Returns team capacity and load bands |
| `/api/analytics/recommendations` | GET | Returns ranked corrective recommendations |
| `/api/simulator/compare` | POST | Decision Simulator: compares baseline vs intervention |
| `/api/copilot/ask` | POST | Grounded Operations Copilot query |
| `/api/outcomes` | GET | Outcome learning logs and acceptance metrics |
| `/api/workflows` | GET / POST | Visual workflow builder & blueprints |
| `/api/audit-logs` | GET | Enterprise compliance audit trail |
| `/api/events` | GET | Server-Sent Events (SSE) real-time streaming |
