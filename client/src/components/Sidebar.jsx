import React from "react";

export default function Sidebar({
  view,
  setView,
  employee,
  logout,
  items = [],
  portalLabel = "Operations Intelligence",
}) {
  const userInitials = employee?.name
    ? employee.name.split(" ").map(p => p[0]).join("").slice(0, 2)
    : "BL";

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">BL</div>
        <div>
          <b>BUSSOLOGIC</b>
          <small>{portalLabel}</small>
        </div>
      </div>

      <div className="workspace">
        <span className="workspace-dot" />
        {portalLabel}
      </div>
<nav>
        {items.map(item => (
          <button
            type="button"
            key={item.id}
            className={`nav-item ${view === item.id ? "active" : ""}`}
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => setView(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <button type="button" className="sidebar-footer sidebar-profile" onClick={logout} title="Click to Sign out">
        <div className="avatar">{userInitials}</div>
        <div>
          <b>{employee?.name || "User"}</b>
          <small>{employee?.roleTitle || "Member"} · ({employee?.role || "employee"})</small>
        </div>
        <span className="more">Sign out</span>
      </button>
    </aside>
  );
}
