import React, { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import Sidebar from "../components/Sidebar.jsx";

export const EMPLOYEE_NAV = [
  { id: "Tasks", label: "My Tasks", icon: "✓" },
  { id: "Projects", label: "My Projects", icon: "📁" },
  { id: "Schedule", label: "My Schedule & Team", icon: "📅" },
  { id: "Profile", label: "My Performance & Profile", icon: "★" },
];
const POLL_MS = 15000; // managers change assignments in another app/process, so poll the shared database
const wrap = { display: "grid", gap: 16 };
const row = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };
const fmt = d => (d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");
const Err = ({ msg }) => (msg ? <div className="auth-error">{msg}</div> : null);
const pct = v => (v == null ? "—" : `${v}%`);
const LABEL = { todo: "To do", in_progress: "In progress", done: "Done", blocked: "Blocked" };
const Stat = ({ label, value }) => (<div className="metric-card"><div className="metric-label">{label}</div><div className="metric-value" style={{ fontSize: "1.6rem" }}>{value}</div></div>);
const Bar = ({ value }) => (<div style={{ background: "rgba(128,128,128,.2)", borderRadius: 6, height: 8, overflow: "hidden", minWidth: 80 }}><div style={{ width: `${value ?? 0}%`, height: "100%", background: "#2457ff" }} /></div>);

/** Loads on mount and every POLL_MS while visible; `paused` stops refresh so a form being edited is not overwritten. */
function useLoad(fn, paused = false) {
  const [data, setData] = useState(null); const [err, setErr] = useState("");
  const load = useCallback(() => fn().then(d => { setData(d); setErr(""); }).catch(e => setErr(e.message)), [fn]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden && !paused) load(); }, POLL_MS);
    return () => clearInterval(id);
  }, [load, paused]);
  return { data, err, load };
}

function TaskCard({ task, onSaved, setEditing }) {
  const [f, setF] = useState({ status: task.status, progress: task.progress ?? 0, hoursLogged: "", blocker: task.blocker ?? "", note: "", completionNote: task.completionNote ?? "" });
  const [err, setErr] = useState(""); const [ok, setOk] = useState(false); const [busy, setBusy] = useState(false);
  const edit = patch => { setF(x => ({ ...x, ...patch })); setEditing(true); setOk(false); };
  const save = async e => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api.updateMyTask(task.id, {
        status: f.status, progress: Number(f.progress), hoursLogged: Number(f.hoursLogged) || 0,
        blocker: f.status === "blocked" ? f.blocker : null, note: f.note || undefined,
        completionNote: f.status === "done" ? f.completionNote : undefined,
      });
      setOk(true); setEditing(false); setF(x => ({ ...x, hoursLogged: "", note: "" })); onSaved();
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <form className="panel task-card" onSubmit={save} style={wrap}>
      <div className="task-card-heading" style={row}><b className="task-title">{task.title}</b>
        <small className="task-meta">{task.projectName} · due {fmt(task.dueAt)} · {task.priority} priority · {task.actualHours ?? 0}/{task.estimatedHours}h</small></div>
      {task.waitingOn.length > 0 && <small>Waiting on: {task.waitingOn.join(", ")}</small>}
      <div className="task-controls" style={row}>
        <select aria-label={`Status for ${task.title}`} value={f.status} onChange={e => edit({ status: e.target.value })}>{Object.entries(LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <label className="progress-control">Progress <b>{f.status === "done" ? 100 : f.progress}%</b><input aria-label={`Progress for ${task.title}`} type="range" min="0" max="100" step="5" disabled={f.status === "done"} value={f.progress} onChange={e => edit({ progress: e.target.value })} /></label>
        <input aria-label={`Hours logged today for ${task.title}`} type="number" min="0" max="24" step="0.5" className="hours-input" placeholder="Hours today" value={f.hoursLogged} onChange={e => edit({ hoursLogged: e.target.value })} />
      </div>
      <input placeholder="Progress note for your manager (optional)" maxLength={500} value={f.note} onChange={e => edit({ note: e.target.value })} />
      {f.status === "blocked" && <input required placeholder="What is blocking you?" value={f.blocker} onChange={e => edit({ blocker: e.target.value })} />}
      {f.status === "done" && <textarea required rows={2} placeholder="Completion note (required)" value={f.completionNote} onChange={e => edit({ completionNote: e.target.value })} />}
      <div className="task-card-actions" style={row}><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Submit update"}</button>{ok && <span>Saved. Your manager sees this live.</span>}</div>
      <Err msg={err} />
    </form>
  );
}

function MyTasks() {
  const [editing, setEditing] = useState(false); const [filter, setFilter] = useState("open");
  const { data, err, load } = useLoad(api.meTasks, editing);
  const tasks = data?.tasks ?? [];
  const shown = tasks.filter(t => (filter === "open" ? t.status !== "done" : filter === "done" ? t.status === "done" : true));
  return (
    <div style={wrap}>
      <div className="task-toolbar" style={row}><div className="task-filters" role="group" aria-label="Filter tasks">{["open", "done", "all"].map(k => <button type="button" key={k} className={`secondary-button ${filter === k ? "active" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{k === "open" ? "Open tasks" : k === "done" ? "Completed" : "All tasks"}</button>)}</div>
        <small>{tasks.filter(t => t.status === "blocked").length} blocked · {tasks.filter(t => t.status !== "done" && t.dueAt && new Date(t.dueAt) < new Date()).length} overdue</small></div>
      <Err msg={err} />
      {data && !shown.length && <div className="panel">No tasks here. Tasks appear once your manager approves an assignment.</div>}
      {shown.map(t => <TaskCard key={`${t.id}-${t.updatedAt}`} task={t} onSaved={load} setEditing={setEditing} />)}
    </div>
  );
}


function MyProjects() {
  const { data, err } = useLoad(api.meProjects);
  const list = data?.projects ?? [];

  const getStatus = (project) => {
    const progress = Number(project.progress ?? 0);

    if (progress >= 100) return "Completed";
    if (progress > 0) return "In progress";
    return "Not started";
  };

  return (
    <div className="projects-page">
      <Err msg={err} />

      <div className="projects-intro">
        <div>
          <span className="projects-eyebrow">WORKSPACE / PROJECTS</span>
          <h2>My projects</h2>
          <p>Track progress, review milestones, and stay on top of your work.</p>
        </div>

        <div className="projects-count">
          <span className="projects-count-number">{list.length}</span>
          <span>Assigned projects</span>
        </div>
      </div>

      {data && list.length === 0 && (
        <div className="projects-empty">
          <div className="projects-empty-icon">◇</div>
          <h3>No projects assigned yet</h3>
          <p>Your assigned projects will appear here when they are available.</p>
        </div>
      )}

      <div className="projects-grid">
        {list.map((p) => {
          const progress = Math.max(
            0,
            Math.min(100, Number(p.progress ?? 0))
          );

          const status = getStatus(p);
          const tasks = p.myTasks ?? [];
          const milestones = p.milestones ?? [];
          const completedTasks = tasks.filter(
            (task) =>
              task.status === "done" ||
              task.status === "completed"
          ).length;

          return (
            <article className="project-card" key={p.id}>
              <div className="project-card-top">
                <div className="project-symbol" aria-hidden="true">
                  ◈
                </div>

                <span
                  className={`project-status ${
                    status === "Completed"
                      ? "is-completed"
                      : status === "In progress"
                      ? "is-progress"
                      : "is-pending"
                  }`}
                >
                  <span className="project-status-dot" />
                  {status}
                </span>
              </div>

              <div className="project-heading">
                <h3>{p.name}</h3>
                <p>{p.description || "No project description provided."}</p>
              </div>

              <div className="project-meta">
                <div className="project-meta-item">
                  <span className="project-meta-label">PROJECT OWNER</span>
                  <span className="project-meta-value">
                    <span className="project-owner-avatar">
                      {(p.ownerName || "U")
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    {p.ownerName || "Unassigned"}
                  </span>
                </div>

                <div className="project-meta-item">
                  <span className="project-meta-label">DUE DATE</span>
                  <span className="project-meta-value">
                    {p.dueAt ? fmt(p.dueAt) : "Not set"}
                  </span>
                </div>
              </div>

              <div className="project-progress-section">
                <div className="project-progress-heading">
                  <span>Overall progress</span>
                  <strong>{progress}%</strong>
                </div>

                <div
                  className="project-progress-track"
                  role="progressbar"
                  aria-label={`${p.name} project progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div
                    className="project-progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="project-progress-caption">
                  <span>{completedTasks} of {tasks.length} tasks completed</span>
                  <span>{milestones.length} milestones</span>
                </div>
              </div>

              {milestones.length > 0 && (
                <div className="project-milestones">
                  <h4>Milestones</h4>

                  <div className="project-milestone-list">
                    {milestones.map((milestone, index) => (
                      <div
                        className="project-milestone"
                        key={milestone.id ?? `${milestone.name}-${index}`}
                      >
                        <span
                          className={`milestone-indicator ${
                            milestone.done ? "is-done" : ""
                          }`}
                          aria-hidden="true"
                        >
                          {milestone.done ? "✓" : ""}
                        </span>

                        <div className="milestone-copy">
                          <span>{milestone.name}</span>
                          <small>
                            {milestone.dueAt
                              ? fmt(milestone.dueAt)
                              : "Date not set"}
                          </small>
                        </div>

                        <span className="milestone-state">
                          {milestone.done ? "Done" : "Upcoming"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="project-tasks-section">
                <div className="project-tasks-heading">
                  <h4>My tasks</h4>
                  <span>{tasks.length}</span>
                </div>

                {tasks.length === 0 ? (
                  <p className="project-no-tasks">
                    No tasks assigned to you in this project.
                  </p>
                ) : (
                  <div className="project-task-list">
                    {tasks.map((task) => (
                      <div className="project-task" key={task.id}>
                        <div className="project-task-main">
                          <span className="project-task-marker" />
                          <span className="project-task-title">
                            {task.title}
                          </span>
                        </div>

                        <div className="project-task-details">
                          <span className="project-task-status">
                            {LABEL[task.status] ?? task.status}
                          </span>

                          <span>{Number(task.progress ?? 0)}%</span>

                          <span>
                            {task.dueAt ? fmt(task.dueAt) : "No due date"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}


function MySchedule() {
  const { data, err } = useLoad(api.meSchedule);
  const today = new Date().toISOString().slice(0, 10);
  const blocks = (data?.blocks ?? []).filter(b => b.date >= today);
  return (
    <div style={wrap}><Err msg={err} />
      <div className="panel schedule-card"><h3 style={{ marginTop: 0 }}>Upcoming schedule</h3>
        {data && !blocks.length && <p>No upcoming schedule blocks.</p>}
        {blocks.map(b => (
          <div className="schedule-item" key={b.id}><span className="schedule-date">{fmt(b.date)}</span><span className="schedule-time">{b.startTime}–{b.endTime}</span><b>{b.type}</b>{b.project ? ` · ${b.project}` : ""}{!b.mine ? ` · ${b.employeeName}` : ""}{b.note ? ` — ${b.note}` : ""}</div>
        ))}
      </div>
      {(data?.teams ?? []).map(t => (
        <div className="panel team-card" key={t.projectId}><h3 style={{ marginTop: 0 }}>{t.name} team <small>· owner {t.ownerName}</small></h3>
          {t.members.map(m => <div className="team-member" key={m.id}><b>{m.name}</b>{m.you ? " (you)" : ""}<span>{m.roleTitle} · {m.availability} · {m.openTasks} open task(s)</span></div>)}
        </div>
      ))}
    </div>
  );
}

function MyProfile({ employee }) {
  const { data: perf, err: perfErr } = useLoad(api.mePerformance);
  const [skills, setSkills] = useState([]); const [availability, setAvailability] = useState("available");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { api.meProfile().then(r => { setSkills(r.profile.skillLevels); setAvailability(r.profile.availability ?? "available"); }).catch(e => setErr(e.message)); }, []);
  const save = async () => {
    setErr(""); setMsg("");
    try { await api.updateMyProfile({ skills: skills.filter(s => s.skill.trim()), availability }); setMsg("Profile saved."); } catch (ex) { setErr(ex.message); }
  };
  return (
    <div style={wrap}><Err msg={perfErr} />
      {perf && (
        <section className="metric-grid">
          <Stat label="Tasks completed" value={`${perf.completed} / ${perf.assigned}`} /><Stat label="Completion rate" value={pct(perf.completionRate)} />
          <Stat label="On-time delivery" value={pct(perf.onTimeRate)} /><Stat label="Estimate accuracy" value={pct(perf.estimateAccuracy)} />
          <Stat label="Hours logged" value={perf.hoursLogged} /><Stat label="Completed (7 days)" value={perf.completedLast7Days} />
        </section>
      )}
      <div className="panel profile-editor" style={wrap}>
        <h3 style={{ margin: 0 }}>{employee.name} · {employee.roleTitle}</h3>
        <small>{employee.email} · {employee.department}</small>
        <b>Skills (level 1–5). The AI uses these when proposing assignments; a manager must approve every assignment.</b>
        {skills.map((s, i) => (
          <div style={row} key={i}>
            <input value={s.skill} onChange={e => setSkills(skills.map((x, j) => (j === i ? { ...x, skill: e.target.value } : x)))} />
            <select value={s.level} onChange={e => setSkills(skills.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)))}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select>
            <button className="secondary-button" onClick={() => setSkills(skills.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <div style={row}>
          <button className="secondary-button" onClick={() => setSkills([...skills, { skill: "", level: 3 }])}>+ Add skill</button>
          <label>Availability <select value={availability} onChange={e => setAvailability(e.target.value)}><option value="available">Available</option><option value="partial">Partially available</option><option value="unavailable">Unavailable</option></select></label>
          <button className="primary-button" onClick={save}>Save profile</button>
        </div>
        {msg && <div className="success-banner">{msg}</div>}<Err msg={err} />
      </div>
      <div className="panel feedback-card"><h3>Manager feedback</h3>
        {perf && !perf.feedback.length && <p>No feedback yet.</p>}
        {perf?.feedback.map(f => <div className="feedback-item" key={f.id}><b>{f.fromName}</b>{f.rating ? ` · ${f.rating}/5` : ""} · {fmt(f.createdAt)}<br />{f.text}</div>)}
      </div>
    </div>
  );
}

export default function EmployeePortal({
  employee,
  logout,
}) {
  const [view, setView] = useState("Tasks");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const viewMeta = {
    Tasks: { title: "My tasks", subtitle: "Stay on top of your work and keep progress moving." },
    Projects: { title: "My projects", subtitle: "See the workstreams you are contributing to." },
    Schedule: { title: "Schedule & team", subtitle: "A clear view of upcoming work and team commitments." },
    Profile: { title: "Performance & profile", subtitle: "Manage your skills, availability, and feedback." },
  };
  const meta = viewMeta[view] || viewMeta.Tasks;
  const initials = (employee?.name || "User").split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
  const changeView = nextView => { setView(nextView); setMobileNavOpen(false); };
  return (
    <div className={`app-shell ${mobileNavOpen ? "mobile-nav-open" : ""}`}>
      <button type="button" className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />
      <Sidebar
  view={view}
  setView={setView}
  employee={employee}
  logout={logout}
  items={EMPLOYEE_NAV}
  portalLabel="Employee Portal"
/>
<main className="main-content">
        <header className="portal-header">
          <div className="portal-heading">
            <button className="mobile-menu-toggle" aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(open => !open)}>☰</button>
            <div>
              <div className="portal-eyebrow"><span className="status-pulse" /> EMPLOYEE WORKSPACE</div>
              <h1>{meta.title}</h1><p>{meta.subtitle}</p>
            </div>
          </div>
          <div className="portal-user-chip"><div className="avatar">{initials}</div><div><b>{employee?.name || "User"}</b><small>{employee?.roleTitle || "Team member"}</small></div></div>
        </header>
        <div className="portal-content" key={view}>
          {view === "Tasks" && <MyTasks />}
          {view === "Projects" && <MyProjects />}
          {view === "Schedule" && <MySchedule />}
          {view === "Profile" && <MyProfile employee={employee} />}
        </div>
      </main>
    </div>
  );
}


