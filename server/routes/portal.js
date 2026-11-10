// Role-based portal API.
//   /api/me/*       any signed-in employee, always scoped to their own records
//   (manager routes live only in the separate Manager Portal app)
import { Router } from "express";
import { z } from "zod";
import { requireEmployee } from "../core/auth.js";
import { createNotification, recordAudit } from "../core/database.js";
import { broadcast } from "../core/events.js";
import { asyncHandler, httpError, parseBody, parseId } from "../core/http.js";
import { find, findOne, insert, patch } from "../core/store.js";
import { isUnassigned, ownsTask, parseSkills } from "../intelligence/allocation.js";

export const portalRouter = Router();
const STATUSES = ["todo", "in_progress", "done", "blocked"];
const DAY = 86_400_000;
const nowIso = () => new Date().toISOString();
const norm = v => String(v ?? "").trim().toLowerCase();

/** One-off, non-destructive: link tasks to employees by id where the name matches exactly one person. */
export async function backfillAssigneeIds() {
  const [tasks, employees] = await Promise.all([find("tasks"), find("employees")]);
  for (const task of tasks) {
    if (task.assigneeId != null || isUnassigned(task)) continue;
    const hits = employees.filter(e => norm(e.name) === norm(task.assignee));
    if (hits.length === 1) await patch("tasks", task.id, { assigneeId: hits[0].id });
  }
}

async function recomputeProjectProgress(projectId) {
  const tasks = await find("tasks", { projectId });
  if (!tasks.length) return;
  const pct = t => (t.status === "done" ? 100 : Number(t.progress) || 0);
  await patch("projects", projectId, {
    progress: Math.round(tasks.reduce((s, t) => s + pct(t), 0) / tasks.length),
  });
}

// =============================== EMPLOYEE (/me) ===============================
const myTasks = async employee => (await find("tasks")).filter(t => ownsTask(employee, t));

portalRouter.get(
  "/me/dashboard",
  requireEmployee,
  asyncHandler(async (req, res) => {
    const me = req.employee;
    const [mine, notifications, updates] = await Promise.all([
      myTasks(me),
      find("notifications", { employeeEmail: me.email }),
      find("task_updates", { employeeId: me.id }),
    ]);
    const open = mine.filter(t => t.status !== "done");
    const now = Date.now();
    const plannedHours = open.reduce(
      (s, t) => s + Math.max(0, (Number(t.estimatedHours) || 4) - (Number(t.actualHours) || 0)), 0);
    const capacity = Number(me.capacityHours) || 40;
    res.json({
      capacityHours: capacity,
      plannedHours: Math.round(plannedHours),
      utilization: Math.round((plannedHours / capacity) * 100),
      openTasks: open.length,
      blockedTasks: open.filter(t => t.status === "blocked").length,
      overdue: open.filter(t => t.dueAt && +new Date(t.dueAt) < now).length,
      dueSoon: open.filter(t => t.dueAt && +new Date(t.dueAt) - now < 3 * DAY && +new Date(t.dueAt) >= now).length,
      deadlines: open.filter(t => t.dueAt).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)).slice(0, 6),
      notifications: notifications.slice(-10).reverse(),
      recentUpdates: updates.slice(-8).reverse(),
    });
  })
);

portalRouter.get(
  "/me/tasks",
  requireEmployee,
  asyncHandler(async (req, res) => {
    const [all, projects] = await Promise.all([find("tasks"), find("projects")]);
    const byId = new Map(all.map(t => [t.id, t]));
    const tasks = all.filter(t => ownsTask(req.employee, t)).map(t => ({
      ...t,
      projectName: projects.find(p => p.id === t.projectId)?.name ?? "",
      waitingOn: (t.dependsOn ?? []).map(id => byId.get(id)).filter(d => d && d.status !== "done").map(d => d.title),
    }));
    res.json({ tasks });
  })
);

portalRouter.get(
  "/me/projects",
  requireEmployee,
  asyncHandler(async (req, res) => {
    const [mine, projects] = await Promise.all([myTasks(req.employee), find("projects")]);
    const out = projects
      .filter(p => mine.some(t => t.projectId === p.id))
      .map(p => ({
        id: p.id, name: p.name, description: p.description, status: p.status,
        progress: p.progress, dueAt: p.dueAt, ownerName: p.ownerName,
        milestones: p.milestones ?? [],
        myTasks: mine.filter(t => t.projectId === p.id)
          .map(t => ({ id: t.id, title: t.title, status: t.status, progress: t.progress ?? 0, dueAt: t.dueAt })),
      }));
    res.json({ projects: out });
  })
);

// Own schedule blocks + schedules of projects the employee works on + that project's team (no emails/skills).
portalRouter.get(
  "/me/schedule",
  requireEmployee,
  asyncHandler(async (req, res) => {
    const me = req.employee;
    const [all, projects, schedules, employees] = await Promise.all([find("tasks"), find("projects"), find("schedules"), find("employees")]);
    const mine = all.filter(t => ownsTask(me, t));
    const ids = new Set(mine.map(t => t.projectId));
    const name = new Map(employees.map(e => [e.id, e.name]));
    const pname = new Map(projects.map(p => [p.id, p.name]));
    const blocks = schedules
      .filter(s => s.employeeId === me.id || (s.projectId != null && ids.has(s.projectId)))
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
      .map(s => ({ id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime, type: s.type, note: s.note,
        projectId: s.projectId ?? null, project: pname.get(s.projectId) ?? null,
        employeeName: name.get(s.employeeId) ?? "", mine: s.employeeId === me.id }));
    const teams = projects.filter(p => ids.has(p.id)).map(p => ({
      projectId: p.id, name: p.name, ownerName: p.ownerName,
      members: employees.filter(e => e.role !== "admin" && all.some(t => t.projectId === p.id && ownsTask(e, t)))
        .map(e => ({ id: e.id, name: e.name, roleTitle: e.roleTitle, availability: e.availability ?? "available", you: e.id === me.id,
          openTasks: all.filter(t => t.projectId === p.id && t.status !== "done" && ownsTask(e, t)).length })),
    }));
    res.json({ blocks, teams });
  })
);

const progressSchema = z.object({
  status: z.enum(STATUSES).optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
  blocker: z.string().trim().max(500).nullish(),
  completionNote: z.string().trim().max(1000).nullish(),
  note: z.string().trim().max(500).nullish(), // free-text progress update
  hoursLogged: z.coerce.number().min(0).max(24).optional(),
});

portalRouter.post(
  "/me/tasks/:id/update",
  requireEmployee,
  asyncHandler(async (req, res) => {
    const me = req.employee;
    const id = parseId(req.params.id, "task id");
    const body = parseBody(progressSchema, req.body);
    const task = await findOne("tasks", { id });
    if (!task) throw httpError(404, "Task not found");
    if (!ownsTask(me, task)) throw httpError(403, "You can only update tasks assigned to you");

    const status = body.status ?? task.status;
    const note = body.completionNote || task.completionNote || null;
    const blocker = status === "blocked" ? body.blocker || task.blocker || null : null;
    if (status === "done" && !note) throw httpError(400, "A completion note is required to finish a task");
    if (status === "blocked" && !blocker) throw httpError(400, "Describe what is blocking this task");

    if (status !== task.status && ["in_progress", "done"].includes(status) && task.dependsOn?.length) {
      const deps = (await find("tasks")).filter(t => task.dependsOn.includes(t.id) && t.status !== "done");
      if (deps.length) throw httpError(409, `Waiting on: ${deps.map(d => d.title).join(", ")}`);
    }

    const at = nowIso();
    const logged = body.hoursLogged ?? 0;
    const progress = status === "done" ? 100 : body.progress ?? task.progress ?? 0;
    const updated = await patch("tasks", id, {
      status, progress, blocker, completionNote: note,
      actualHours: (Number(task.actualHours) || 0) + logged,
      ...(body.note ? { lastNote: body.note } : {}), lastUpdatedBy: me.name,
      completedAt: status === "done" ? task.completedAt ?? at : null,
    });
    await insert("task_updates", {
      taskId: id, projectId: task.projectId, taskTitle: task.title,
      employeeId: me.id, employeeName: me.name,
      prevStatus: task.status, status, progress, hoursLogged: logged,
      blocker, note: body.completionNote || body.note || null, at,
    });
    await recomputeProjectProgress(task.projectId);

    const project = await findOne("projects", { id: task.projectId });
    if (blocker && blocker !== task.blocker) {
      await insert("alerts", {
        title: "Task blocked", detail: `${me.name}: ${blocker}`, severity: "high",
        projectName: project?.name ?? "", taskId: id, resolved: 0,
      });
      const owner = project && (await findOne("employees", { name: project.ownerName }));
      if (owner) await createNotification({ employeeEmail: owner.email, title: "Task blocked", body: `${me.name} reported a blocker on '${task.title}': ${blocker}` });
    }
    await recordAudit(me, "progress_update", "task", id,
      `${me.name} set '${task.title}' to ${status} (${progress}%)${logged ? `, logged ${logged}h` : ""}`);
    broadcast("task.updated", { taskId: id, status });
    res.json({ task: updated });
  })
);

portalRouter.get(
  "/me/performance",
  requireEmployee,
  asyncHandler(async (req, res) => {
    const me = req.employee;
    const [mine, updates, feedback] = await Promise.all([
      myTasks(me), find("task_updates", { employeeId: me.id }), find("feedback", { employeeId: me.id }),
    ]);
    const done = mine.filter(t => t.status === "done");
    const timed = done.filter(t => t.completedAt && t.dueAt);
    const withHours = done.filter(t => Number(t.actualHours) > 0);
    const weekAgo = Date.now() - 7 * DAY;
    const ratio = (a, b) => (b ? Math.round((a / b) * 100) : null);
    res.json({
      assigned: mine.length,
      completed: done.length,
      completionRate: ratio(done.length, mine.length),
      onTimeRate: ratio(timed.filter(t => t.completedAt <= t.dueAt).length, timed.length),
      estimateAccuracy: ratio(
        withHours.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0),
        withHours.reduce((s, t) => s + Number(t.actualHours), 0)),
      hoursLogged: Math.round(updates.reduce((s, u) => s + (u.hoursLogged || 0), 0) * 10) / 10,
      completedLast7Days: done.filter(t => t.completedAt && +new Date(t.completedAt) >= weekAgo).length,
      feedback: feedback.slice().reverse(),
    });
  })
);

portalRouter.get(
  "/me/profile",
  requireEmployee,
  asyncHandler(async (req, res) => {
    const me = req.employee;
    res.json({ profile: { ...me, skillLevels: parseSkills(me) } });
  })
);

const profileSchema = z.object({
  skills: z.array(z.object({ skill: z.string().trim().min(1).max(60), level: z.coerce.number().int().min(1).max(5) })).max(30),
  availability: z.enum(["available", "partial", "unavailable"]).optional(),
});

portalRouter.patch(
  "/me/profile",
  requireEmployee,
  asyncHandler(async (req, res) => {
    const body = parseBody(profileSchema, req.body);
    const skillLevels = body.skills.map(s => ({ skill: norm(s.skill), level: s.level }));
    const updated = await patch("employees", req.employee.id, {
      skillLevels, skills: skillLevels.map(s => s.skill).join(", "),
      ...(body.availability ? { availability: body.availability } : {}),
    });
    await recordAudit(req.employee, "updated_profile", "employee", req.employee.id, "Updated skills/availability");
    res.json({ profile: { ...updated, skillLevels } });
  })
);
