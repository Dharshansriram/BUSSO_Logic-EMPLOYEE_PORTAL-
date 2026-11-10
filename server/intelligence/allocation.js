// Explainable skill/availability/workload matching. Pure functions: no I/O, no side effects.
const norm = value => String(value ?? "").trim().toLowerCase();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const LEAVE_TYPES = new Set(["leave", "off", "pto", "vacation", "sick"]);
const AVAILABILITY = { available: 1, partial: 0.6, unavailable: 0 };

/** Structured skills [{skill, level 1-5}]; falls back to the legacy comma-separated string. */
export function parseSkills(employee) {
  if (Array.isArray(employee.skillLevels) && employee.skillLevels.length) {
    return employee.skillLevels
      .map(s => ({ skill: norm(s.skill), level: clamp(Number(s.level) || 3, 1, 5) }))
      .filter(s => s.skill);
  }
  return String(employee.skills ?? "")
    .split(",")
    .map(norm)
    .filter(Boolean)
    .map(skill => ({ skill, level: 3 }));
}

export const ownsTask = (employee, task) =>
  task.assigneeId != null
    ? task.assigneeId === employee.id
    : norm(task.assignee) === norm(employee.name);

export const isUnassigned = task =>
  task.assigneeId == null && (!task.assignee || norm(task.assignee) === "unassigned");

const remainingHours = task =>
  Math.max(0, (Number(task.estimatedHours) || 4) - (Number(task.actualHours) || 0));

const skillMatch = (have, need) =>
  have.find(s => s.skill === need || s.skill.includes(need) || need.includes(s.skill));

export function scoreCandidate({ employee, task, tasks, schedules = [], pendingHours = 0 }) {
  const required = (task.requiredSkills ?? []).map(r => ({
    skill: norm(r.skill),
    minLevel: clamp(Number(r.minLevel) || 3, 1, 5),
  }));
  const have = parseSkills(employee);
  const matched = [];
  const missing = [];
  let fitSum = 0;
  for (const need of required) {
    const found = skillMatch(have, need.skill);
    if (!found) {
      missing.push(need.skill);
      continue;
    }
    const ratio = Math.min(1, found.level / need.minLevel);
    fitSum += ratio;
    matched.push(`${need.skill} (level ${found.level}/${need.minLevel} required)`);
    if (ratio < 1) missing.push(`${need.skill} depth`);
  }
  const skillFit = required.length ? fitSum / required.length : 0;

  const capacity = Number(employee.capacityHours) || 40;
  const openHours = tasks
    .filter(t => t.status !== "done" && ownsTask(employee, t))
    .reduce((sum, t) => sum + remainingHours(t), 0);
  const utilizationAfter = (openHours + pendingHours + remainingHours(task)) / capacity;

  let availability = AVAILABILITY[employee.availability] ?? 1;
  const dueDay = String(task.dueAt ?? "").slice(0, 10);
  const onLeave = schedules.some(
    s => s.employeeId === employee.id && LEAVE_TYPES.has(norm(s.type)) && String(s.date).slice(0, 10) === dueDay
  );
  if (onLeave) availability *= 0.5;

  const headroom = clamp(1 - utilizationAfter, 0, 1);
  const score = 0.55 * skillFit + 0.3 * headroom + 0.15 * availability;
  const eligible = skillFit >= 0.5 && availability > 0 && utilizationAfter <= 1.1;

  const reasons = [
    required.length
      ? `Skill fit ${Math.round(skillFit * 100)}%: ${matched.length ? matched.join(", ") : "no required skills matched"}`
      : "Task has no required skills defined",
    ...(missing.length ? [`Gaps: ${missing.join(", ")}`] : []),
    `Workload after assignment: ${Math.round(utilizationAfter * 100)}% of ${capacity}h capacity (${Math.round(openHours + pendingHours)}h already open)`,
    `Availability: ${employee.availability ?? "available"}${onLeave ? ", on leave around the due date" : ""}`,
  ];
  return {
    employeeId: employee.id,
    name: employee.name,
    score: Math.round(score * 100),
    skillFit: Math.round(skillFit * 100),
    utilizationAfter: Math.round(utilizationAfter * 100),
    availability: employee.availability ?? "available",
    eligible,
    reasons,
  };
}

/** One proposal per task. `pending` tracks hours proposed earlier in the batch so load is spread. */
export function proposeAssignments({ tasks, candidatesTasks, employees, schedules }) {
  const pending = new Map();
  const proposals = [];
  const skipped = [];
  for (const task of candidatesTasks) {
    if (!task.requiredSkills?.length) {
      skipped.push({ taskId: task.id, reason: "No required skills defined for this task" });
      continue;
    }
    const ranked = employees
      .filter(e => e.role !== "admin")
      .map(employee =>
        scoreCandidate({ employee, task, tasks, schedules, pendingHours: pending.get(employee.id) ?? 0 })
      )
      .sort((a, b) => b.score - a.score);
    const best = ranked.find(c => c.eligible) ?? null;
    if (best) pending.set(best.employeeId, (pending.get(best.employeeId) ?? 0) + remainingHours(task));
    proposals.push({
      taskId: task.id,
      projectId: task.projectId,
      taskTitle: task.title,
      requiredSkills: task.requiredSkills,
      recommendedEmployeeId: best?.employeeId ?? null,
      confidence: best?.score ?? 0,
      reasoning: best
        ? [`Recommended ${best.name}: highest combined score (${best.score}/100).`, ...best.reasons]
        : ["No employee meets the skill, availability and workload requirements. Consider training, rescheduling or hiring."],
      candidates: ranked.slice(0, 3),
    });
  }
  return { proposals, skipped };
}
