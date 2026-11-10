// Seed data used to populate an empty MongoDB, and as the in-memory fallback store
// when MongoDB is not reachable.

const HOUR = 3_600_000;
export const nowIso = () => new Date().toISOString();
export const futureIso = hours =>
  new Date(Date.now() + hours * HOUR).toISOString();
export const pastIso = hours =>
  new Date(Date.now() - hours * HOUR).toISOString();

export const DEMO_PASSWORD = "Welcome123!";

export const DEMO_PROJECTS = [
  {
    id: 1,
    name: "Customer onboarding",
    description: "Automate the new customer journey from contract to go-live.",
    status: "active",
    progress: 68,
    ownerName: "Maya Chen",
    dueAt: futureIso(96),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 2,
    name: "Q4 hiring sprint",
    description:
      "Coordinate interviews, approvals, and onboarding for priority roles.",
    status: "at_risk",
    progress: 42,
    ownerName: "Jon Bell",
    dueAt: futureIso(48),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 3,
    name: "Security review",
    description: "Close the access review and evidence collection workflow.",
    status: "active",
    progress: 81,
    ownerName: "Ari Singh",
    dueAt: futureIso(216),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

export const DEMO_TASKS = [
  {
    id: 1,
    projectId: 1,
    title: "Verify legal documents",
    assignee: "Maya Chen",
    stage: "Document review",
    status: "in_progress",
    priority: "high",
    dueAt: futureIso(7),
    estimatedHours: 8,
    actualHours: 5,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 2,
    projectId: 1,
    title: "Schedule implementation call",
    assignee: "Noah Williams",
    stage: "Kickoff",
    status: "todo",
    priority: "medium",
    dueAt: futureIso(23),
    estimatedHours: 4,
    actualHours: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 3,
    projectId: 2,
    title: "Panel feedback collection",
    assignee: "Jon Bell",
    stage: "Interview loop",
    status: "blocked",
    priority: "critical",
    dueAt: futureIso(5),
    estimatedHours: 6,
    actualHours: 8,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 4,
    projectId: 3,
    title: "Access evidence export",
    assignee: "Ari Singh",
    stage: "Evidence",
    status: "done",
    priority: "low",
    dueAt: pastIso(6),
    estimatedHours: 5,
    actualHours: 4,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

export const DEMO_EMPLOYEES = [
  {
    id: 1,
    name: "Maya Chen",
    email: "maya@acme.test",
    role: "manager",
    department: "Customer Success",
    roleTitle: "Implementation Lead",
    capacityHours: 40,
    availability: "partial",
    skills: "onboarding, compliance, customer success",
    managerName: "Ari Singh",
    createdAt: nowIso(),
  },
  {
    id: 2,
    name: "Noah Williams",
    email: "noah@acme.test",
    role: "employee",
    department: "Customer Success",
    roleTitle: "Implementation Specialist",
    capacityHours: 40,
    availability: "available",
    skills: "onboarding, training, integrations",
    managerName: "Maya Chen",
    createdAt: nowIso(),
  },
  {
    id: 3,
    name: "Jon Bell",
    email: "jon@acme.test",
    role: "manager",
    department: "People Operations",
    roleTitle: "Recruiting Manager",
    capacityHours: 32,
    availability: "available",
    skills: "recruiting, interviews, sourcing",
    managerName: "Ari Singh",
    createdAt: nowIso(),
  },
  {
    id: 4,
    name: "Ari Singh",
    email: "ari@acme.test",
    role: "admin",
    department: "Security",
    roleTitle: "Security Program Manager",
    capacityHours: 40,
    availability: "available",
    skills: "security, audits, risk",
    managerName: "Maya Chen",
    createdAt: nowIso(),
  },
];

const today = new Date().toISOString().slice(0, 10);

export const DEMO_SCHEDULES = [
  {
    id: 1,
    employeeId: 1,
    date: today,
    startTime: "09:00",
    endTime: "17:00",
    type: "work",
    note: "Customer onboarding coverage",
    createdAt: nowIso(),
  },
  {
    id: 2,
    employeeId: 1,
    date: today,
    startTime: "13:00",
    endTime: "14:00",
    type: "meeting",
    note: "Weekly implementation review",
    createdAt: nowIso(),
  },
  {
    id: 3,
    employeeId: 2,
    date: today,
    startTime: "09:00",
    endTime: "17:00",
    type: "work",
    note: "Available for reassignment",
    createdAt: nowIso(),
  },
  {
    id: 4,
    employeeId: 3,
    date: today,
    startTime: "10:00",
    endTime: "16:00",
    type: "focus",
    note: "Interview loop",
    createdAt: nowIso(),
  },
];

export const DEMO_RECOMMENDATIONS = [
  {
    id: 1,
    title: "Rebalance the onboarding queue",
    detail:
      "Noah has capacity to absorb the implementation call and protect the Friday milestone.",
    type: "capacity",
    confidence: 94,
    source: "rules",
    expectedBenefit:
      "Reduces Maya's load from 96% to 74% and cuts delivery delay probability by 28%.",
    evidence:
      "Noah planned hours: 4h / 40h (10% utilization). Maya planned hours: 38h / 40h (95% utilization).",
    alternatives:
      "Postpone onboarding kickoff by 48h, or bring in contract specialist.",
    createdAt: nowIso(),
  },
  {
    id: 2,
    title: "Escalate panel feedback",
    detail:
      "The hiring sprint is trending behind plan. Ask the panel lead for feedback before 16:00.",
    type: "risk",
    confidence: 87,
    source: "rules",
    expectedBenefit: "Unblocks task #3 and avoids 2-day candidate offer delay.",
    evidence:
      "Task #3 has been marked 'blocked' for 8 hours with critical priority.",
    alternatives: "Re-run candidate loop or waive panel approval requirement.",
    createdAt: nowIso(),
  },
];

export const DEMO_ALERTS = [
  {
    id: 1,
    title: "Task likely to miss deadline",
    detail: "Panel feedback collection has a 78% delay probability.",
    severity: "critical",
    projectName: "Q4 hiring sprint",
    resolved: 0,
    createdAt: pastIso(0.35),
  },
  {
    id: 2,
    title: "Workload imbalance detected",
    detail: "Maya is at 96% capacity across active workflows.",
    severity: "warning",
    projectName: "Customer onboarding",
    resolved: 0,
    createdAt: pastIso(0.7),
  },
];

export const DEMO_ACTIVITY = [
  {
    id: 1,
    actor: "Maya Chen",
    action: "completed",
    entity: "Security evidence export",
    createdAt: pastIso(0.2),
  },
  {
    id: 2,
    actor: "AI assistant",
    action: "flagged a risk in",
    entity: "Q4 hiring sprint",
    createdAt: pastIso(0.5),
  },
  {
    id: 3,
    actor: "Jon Bell",
    action: "updated",
    entity: "Panel feedback collection",
    createdAt: pastIso(0.7),
  },
];

// ---- Fallback in-memory stores (used when MongoDB is unavailable, and for
// ---- data that is not persisted: workflows, simulation history, outcomes) ----
export const fallbackSessions = new Map(); // token -> { employeeId, expiresAt (ms) }
export const fallbackResetTokens = new Map(); // token -> { email, expiresAt (ms) }
export const fallbackAudit = [];
export const fallbackInvitations = [];
export const fallbackNotifications = [];
export const fallbackSimulations = [];
export const fallbackOutcomes = [];
export const fallbackWorkflows = [
  {
    id: 1,
    name: "Customer Onboarding Streamlined",
    trigger: "contract_signed",
    stages: [
      "Intake & approval",
      "Document verification",
      "Technical kickoff",
      "Final confirmation",
    ],
    status: "active",
    createdAt: nowIso(),
  },
];
