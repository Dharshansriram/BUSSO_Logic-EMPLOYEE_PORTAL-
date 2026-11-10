
import React, { useEffect, useState } from "react";
import "./bussologic.css";
import { api } from "./lib/api";
import Login from "./pages/Login.jsx";
import Activate from "./pages/Activate.jsx";
import EmployeePortal from "./portal/EmployeePortal.jsx";

export default function App() {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  // Employee Portal is light-mode only.
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
    try {
      localStorage.removeItem("bussologic-theme");
    } catch {
      // Light mode remains active even when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    api
      .getMe()
      .then(r => setEmployee(r.employee))
      .catch(() => setEmployee(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Preserve existing logout behavior.
    }

    setEmployee(null);
  };


  if (window.location.pathname === "/activate") {
    return <Activate />;
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="brand-mark">BL</div>
        <span>Loading your workspace…</span>
      </div>
    );
  }

  if (!employee) {
    return <Login onLoginSuccess={setEmployee} />;
  }

  return (
    <EmployeePortal
      employee={employee}
      logout={logout}
    />
  );
}
