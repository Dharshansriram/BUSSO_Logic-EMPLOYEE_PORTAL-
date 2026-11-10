// BUSSOLOGIC Centralized API Client

const BASE = "/api";

async function request(endpoint, options = {}) {
  const url = `${BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Session expired or unauthenticated
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.error || "Please sign in to continue");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  getMe: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => request("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),

  // Invitation activation (public)
  checkActivation: (token) => request("/auth/activation/check", { method: "POST", body: JSON.stringify({ token }) }),
  activateAccount: (token, password, confirmPassword) => request("/auth/activate", { method: "POST", body: JSON.stringify({ token, password, confirmPassword }) }),

  // Employee portal (/me/*: always scoped to the signed-in employee on the server)
  meDashboard: () => request("/me/dashboard"),
  meTasks: () => request("/me/tasks"),
  meProjects: () => request("/me/projects"),
  meSchedule: () => request("/me/schedule"),
  mePerformance: () => request("/me/performance"),
  meProfile: () => request("/me/profile"),
  updateMyProfile: (data) => request("/me/profile", { method: "PATCH", body: JSON.stringify(data) }),
  updateMyTask: (id, data) => request(`/me/tasks/${id}/update`, { method: "POST", body: JSON.stringify(data) }),
};
