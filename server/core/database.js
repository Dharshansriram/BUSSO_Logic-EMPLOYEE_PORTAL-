import { MongoClient } from "mongodb";
import { ENV } from "../_core/env.js";
import { hashPassword } from "./passwords.js";
import {
  DEMO_ACTIVITY,
  DEMO_ALERTS,
  DEMO_EMPLOYEES,
  DEMO_PASSWORD,
  DEMO_PROJECTS,
  DEMO_RECOMMENDATIONS,
  DEMO_SCHEDULES,
  DEMO_TASKS,
  fallbackAudit,
  fallbackInvitations,
  fallbackNotifications,
} from "./demoData.js";

const log = {
  info: (...args) => console.log("[db]", ...args),
  warn: (...args) => console.warn("[db]", ...args),
  error: (...args) => console.error("[db]", ...args),
};

const RETRY_AFTER_MS = 30_000; // don't re-attempt a failed connection on every request

let client = null;
let db = null;
let connecting = null;
let lastFailureAt = 0;
let seeded = false;
let lastAuditId = 0;

// ---- helpers ---------------------------------------------------------------
export function strip(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const { _id, __v, ...item } = doc;
  for (const [key, value] of Object.entries(item)) {
    if (value instanceof Date) item[key] = value.toISOString();
  }
  return item;
}
export const rows = items => items.map(strip);

/** Employee record without any credential material. */
export function publicEmployee(employee) {
  if (!employee) return null;
  const {
    passwordHash,
    resetTokenHash,
    resetTokenExpiresAt,
    inviteTokenHash,
    ...rest
  } = strip(employee);
  return rest;
}

const dbNameFromUri = uri =>
  /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/.exec(uri)?.[1] ?? null;

// ---- connection ------------------------------------------------------------
export async function getDb() {
  if (db) return db;
  if (connecting) return connecting;
  if (Date.now() - lastFailureAt < RETRY_AFTER_MS) return null;

  connecting = (async () => {
    try {
      client = new MongoClient(ENV.mongoUri, {
        serverSelectionTimeoutMS: 2000,
      });
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      // Atlas URIs often have no /dbname, so fall back to MONGODB_DB.
      db = client.db(dbNameFromUri(ENV.mongoUri) ?? ENV.mongoDb);
      log.info(`Connected to MongoDB database "${db.databaseName}"`);
      return db;
    } catch (error) {
      lastFailureAt = Date.now();
      db = null;
      await client?.close().catch(() => {});
      client = null;
      log.warn(
        `MongoDB unavailable (${error.message}). Using in-memory demo data.`
      );
      return null;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

export async function closeDb() {
  await client?.close().catch(() => {});
  client = null;
  db = null;
}

export function mongoStatus() {
  return {
    connected: Boolean(db),
    database: db?.databaseName ?? null,
    mode: db ? "mongodb" : "in-memory-fallback",
  };
}

// In-memory collections used when MongoDB is not connected.
const memory = {
  tasks: DEMO_TASKS,
  employees: DEMO_EMPLOYEES,
  projects: DEMO_PROJECTS,
  schedules: DEMO_SCHEDULES,
  recommendations: DEMO_RECOMMENDATIONS,
  alerts: DEMO_ALERTS,
  invitations: fallbackInvitations,
  notifications: fallbackNotifications,
};

export async function nextId(collection) {
  const database = await getDb();
  if (database) {
    const latest = await database
      .collection(collection)
      .findOne({}, { sort: { id: -1 }, projection: { id: 1 } });
    return (latest?.id ?? 0) + 1;
  }
  return (
    Math.max(0, ...(memory[collection] ?? []).map(item => item.id ?? 0)) + 1
  );
}

export async function ensureSeed() {
  if (seeded) return;
  const database = await getDb();
  if (database) {
    try {
      if ((await database.collection("projects").countDocuments({})) === 0) {
        const clone = list => list.map(item => ({ ...item }));
        const passwordHash = hashPassword(DEMO_PASSWORD);
        await database.collection("projects").insertMany(clone(DEMO_PROJECTS));
        await database.collection("tasks").insertMany(clone(DEMO_TASKS));
        await database
          .collection("employees")
          .insertMany(DEMO_EMPLOYEES.map(e => ({ ...e, passwordHash })));
        await database
          .collection("schedules")
          .insertMany(clone(DEMO_SCHEDULES));
        await database
          .collection("recommendations")
          .insertMany(clone(DEMO_RECOMMENDATIONS));
        await database.collection("alerts").insertMany(clone(DEMO_ALERTS));
        await database
          .collection("activities")
          .insertMany(clone(DEMO_ACTIVITY));
        log.info("Seeded demo collections.");
      }
    } catch (error) {
      log.warn("Seeding error:", error.message);
    }
  }
  seeded = true;
}

// ---- reads -----------------------------------------------------------------
const demoDashboard = () => ({
  projects: DEMO_PROJECTS,
  tasks: DEMO_TASKS,
  recommendations: DEMO_RECOMMENDATIONS,
  alerts: DEMO_ALERTS.filter(alert => alert.resolved !== 1),
  activity: DEMO_ACTIVITY,
});

const demoPeople = () => ({
  employees: DEMO_EMPLOYEES.map(publicEmployee),
  schedules: DEMO_SCHEDULES,
  invitations: fallbackInvitations,
});

export async function getDashboardData() {
  await ensureSeed();
  const database = await getDb();
  if (!database) return demoDashboard();
  try {
    const find = (name, filter, sort, limit) =>
      database.collection(name).find(filter).sort(sort).limit(limit).toArray();
    const [projects, tasks, recommendations, alerts, activity] =
      await Promise.all([
        find("projects", {}, { updatedAt: -1 }, 100),
        find("tasks", {}, { updatedAt: -1 }, 200),
        find("recommendations", {}, { createdAt: -1 }, 50),
        find("alerts", { resolved: 0 }, { createdAt: -1 }, 50),
        find("activities", {}, { createdAt: -1 }, 15),
      ]);
    return {
      projects: rows(projects),
      tasks: rows(tasks),
      recommendations: rows(recommendations),
      alerts: rows(alerts),
      activity: rows(activity),
    };
  } catch (error) {
    log.error("Error reading dashboard:", error.message);
    return demoDashboard();
  }
}

export async function getPeopleData() {
  await ensureSeed();
  const database = await getDb();
  if (!database) return demoPeople();
  try {
    const find = (name, sort, limit) =>
      database.collection(name).find({}).sort(sort).limit(limit).toArray();
    const [employees, schedules, invitations] = await Promise.all([
      find("employees", { name: 1 }, 100),
      find("schedules", { date: -1 }, 200),
      find("invitations", { createdAt: -1 }, 50),
    ]);
    const demo = demoPeople();
    return {
      employees: employees.length
        ? employees.map(publicEmployee)
        : demo.employees,
      schedules: schedules.length ? rows(schedules) : demo.schedules,
      invitations: rows(invitations),
    };
  } catch (error) {
    log.error("Error reading people data:", error.message);
    return demoPeople();
  }
}

export async function getTasks() {
  const database = await getDb();
  if (!database) return DEMO_TASKS;
  return rows(
    await database
      .collection("tasks")
      .find({})
      .sort({ id: 1 })
      .limit(500)
      .toArray()
  );
}

export async function getProjects() {
  const database = await getDb();
  if (!database) return DEMO_PROJECTS;
  return rows(
    await database
      .collection("projects")
      .find({})
      .sort({ id: 1 })
      .limit(200)
      .toArray()
  );
}

// ---- writes ----------------------------------------------------------------
export async function updateTaskStatus(taskId, status) {
  const now = new Date().toISOString();
  const database = await getDb();
  if (!database) {
    const task = DEMO_TASKS.find(item => item.id === taskId);
    if (!task) return null;
    Object.assign(task, { status, updatedAt: now });
    return task;
  }
  const updated = await database
    .collection("tasks")
    .findOneAndUpdate(
      { id: taskId },
      { $set: { status, updatedAt: now } },
      { returnDocument: "after" }
    );
  return strip(updated);
}

export async function createTask(data) {
  const now = new Date().toISOString();
  const task = {
    id: await nextId("tasks"),
    projectId: data.projectId ?? 1,
    title: data.title ?? "Untitled task",
    assignee: data.assignee ?? "Unassigned",
    stage: data.stage ?? "General",
    status: data.status ?? "todo",
    priority: data.priority ?? "medium",
    dueAt: data.dueAt ?? new Date(Date.now() + 2 * 86_400_000).toISOString(),
    estimatedHours: data.estimatedHours ?? 4,
    actualHours: data.actualHours ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  const database = await getDb();
  if (!database) DEMO_TASKS.push(task);
  else await database.collection("tasks").insertOne({ ...task });
  return task;
}

export async function createProject(data) {
  const now = new Date().toISOString();
  const project = {
    id: await nextId("projects"),
    name: data.name ?? "New Project",
    description: data.description ?? "",
    status: data.status ?? "active",
    progress: data.progress ?? 0,
    ownerName: data.ownerName ?? "Maya Chen",
    dueAt: data.dueAt ?? new Date(Date.now() + 14 * 86_400_000).toISOString(),
    createdAt: now,
    updatedAt: now,
  };
  const database = await getDb();
  if (!database) DEMO_PROJECTS.push(project);
  else await database.collection("projects").insertOne({ ...project });
  return project;
}

export async function resolveAlert(alertId) {
  const now = new Date().toISOString();
  const database = await getDb();
  if (!database) {
    for (const alert of DEMO_ALERTS)
      if (alert.id === alertId)
        Object.assign(alert, { resolved: 1, updatedAt: now });
    return true;
  }
  await database
    .collection("alerts")
    .updateOne({ id: alertId }, { $set: { resolved: 1, updatedAt: now } });
  return true;
}

/**
 * Creates a PENDING employee with no password. The account cannot sign in until the
 * invited person activates it (see core/invites.js). Throws code "DUPLICATE_EMAIL".
 */
export async function createEmployee(data, extra = {}) {
  const email = String(data.email).toLowerCase().trim();
  const database = await getDb();
  const duplicate = () =>
    Object.assign(new Error("An account with this email already exists"), {
      code: "DUPLICATE_EMAIL",
    });
  const taken = database
    ? await database.collection("employees").findOne({ email })
    : DEMO_EMPLOYEES.find(item => item.email.toLowerCase() === email);
  if (taken) throw duplicate();

  const employee = {
    id: await nextId("employees"),
    name: data.name,
    email,
    role: data.role ?? "employee",
    department: data.department,
    roleTitle: data.roleTitle,
    capacityHours: Number.parseInt(data.capacityHours ?? 40, 10) || 40,
    availability: "available",
    skills: data.skills ?? "",
    managerName: data.managerName ?? "Maya Chen",
    createdAt: new Date().toISOString(),
    status: "pending",
    ...extra,
  };
  if (!database) DEMO_EMPLOYEES.push(employee);
  else {
    // Unique index closes the check-then-insert race; ignore if legacy data has duplicates.
    await database
      .collection("employees")
      .createIndex({ email: 1 }, { unique: true })
      .catch(() => {});
    try {
      await database.collection("employees").insertOne({ ...employee });
    } catch (error) {
      if (error?.code === 11000) throw duplicate();
      throw error;
    }
  }
  return publicEmployee(employee);
}

export async function updateEmployeeRole(employeeId, role) {
  const database = await getDb();
  if (!database) {
    const employee = DEMO_EMPLOYEES.find(item => item.id === employeeId);
    if (!employee) return null;
    employee.role = role;
    return publicEmployee(employee);
  }
  const updated = await database
    .collection("employees")
    .findOneAndUpdate(
      { id: employeeId },
      { $set: { role, updatedAt: new Date().toISOString() } },
      { returnDocument: "after" }
    );
  return publicEmployee(updated);
}

export async function createSchedule(data) {
  const schedule = {
    id: await nextId("schedules"),
    employeeId: Number(data.employeeId),
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    type: data.type,
    note: data.note ?? "",
    ...(data.projectId != null ? { projectId: Number(data.projectId) } : {}),
    createdAt: new Date().toISOString(),
  };
  const database = await getDb();
  if (!database) DEMO_SCHEDULES.push(schedule);
  else await database.collection("schedules").insertOne({ ...schedule });
  return schedule;
}

export async function createInvitation(data) {
  const invitation = {
    id: await nextId("invitations"),
    email: String(data.email).toLowerCase().trim(),
    role: data.role,
    department: data.department,
    roleTitle: data.roleTitle ?? "",
    invitedBy: data.invitedBy ?? "Maya Chen",
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const database = await getDb();
  if (!database) fallbackInvitations.push(invitation);
  else await database.collection("invitations").insertOne({ ...invitation });
  return invitation;
}

export async function createNotification(data) {
  const notification = {
    id: await nextId("notifications"),
    employeeEmail: data.employeeEmail,
    title: data.title,
    body: data.body,
    channel: data.channel ?? "in_app",
    createdAt: new Date().toISOString(),
  };
  const database = await getDb();
  if (!database) fallbackNotifications.push(notification);
  else
    await database.collection("notifications").insertOne({ ...notification });
  return notification;
}

// ---- audit -----------------------------------------------------------------
export async function recordAudit(
  actor,
  action,
  entityType,
  entityId,
  detail,
  metadata = {}
) {
  lastAuditId = Math.max(Date.now(), lastAuditId + 1); // unique even within one millisecond
  const entry = {
    id: lastAuditId,
    actorId: actor?.id ?? 0,
    actorName: actor?.name ?? "System",
    actorRole: actor?.role ?? "system",
    action,
    entityType,
    entityId: entityId ?? null,
    detail,
    metadata: metadata ?? {},
    createdAt: new Date().toISOString(),
  };
  const database = await getDb();
  if (!database) fallbackAudit.unshift(entry);
  else await database.collection("audit_logs").insertOne({ ...entry });
  return entry;
}

export async function getAuditLogs(limit = 100) {
  const database = await getDb();
  if (!database) return fallbackAudit.slice(0, limit);
  return rows(
    await database
      .collection("audit_logs")
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
  );
}
