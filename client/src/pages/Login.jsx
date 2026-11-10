import React, { useState } from "react";
import { api } from "../lib/api";

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // login | forgot | reset
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await api.login(email, password);
      onLoginSuccess(res.employee);
    } catch (err) {
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await api.forgotPassword(email);
      setMessage(res.message);
      if (res.resetToken) {
        setToken(res.resetToken);
        setMode("reset");
      }
    } catch (err) {
      setError(err.message || "Failed to process request");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await api.resetPassword(token, newPassword);
      setMessage("Password successfully updated. You may now sign in.");
      setMode("login");
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand login-brand">
          <div className="brand-mark">BL</div>
          <div>
            <b>BUSSOLOGIC</b>
            <small>Operations Intelligence Platform</small>
          </div>
        </div>

        <p className="eyebrow">ENTERPRISE CONTROL PLANE</p>
        <h1>
          {mode === "login"
            ? "Sign In to Workspace"
            : mode === "forgot"
            ? "Password Recovery"
            : "Set New Password"}
        </h1>
        <p className="login-subtitle">
          {mode === "login"
            ? "Predict Risks. Optimize Decisions. Automate Outcomes."
            : "Authorized workspace password recovery."}
        </p>

        {(error || message) && (
          <div className={error ? "auth-error" : "success-banner"}>
            {error || message}
          </div>
        )}

        {mode === "login" && (
          <>
            <form onSubmit={handleLogin} className="login-form">
              <label className="form-label">
                Work Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="form-label">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                className="primary-button full"
                disabled={loading}
              >
                {loading ? "Authenticating…" : "Sign In to BUSSOLOGIC"}
              </button>
            </form>
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                setError("");
                setMessage("");
                setMode("forgot");
              }}
            >
              Forgot your password?
            </button>
          </>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleForgot} className="login-form">
            <label className="form-label">
              Existing Account Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button
              type="submit"
              className="primary-button full"
              disabled={loading}
            >
              {loading ? "Sending…" : "Send Reset Token"}
            </button>
            <button
              type="button"
              className="auth-link"
              onClick={() => setMode("login")}
            >
              Back to Sign In
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={handleReset} className="login-form">
            <label className="form-label">
              Reset Token
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </label>
            <label className="form-label">
              New Password (min 8 characters)
              <input
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>
            <button
              type="submit"
              className="primary-button full"
              disabled={loading}
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
            <button
              type="button"
              className="auth-link"
              onClick={() => setMode("login")}
            >
              Back to Sign In
            </button>
          </form>
        )}

        <div className="demo-credentials">
          <b>Pre-seeded Demo Access</b>
          <span>Email: <code>maya@acme.test</code> (Manager)</span>
          <span>Password: <code>Welcome123!</code></span>
          <span style={{ marginTop: 4, fontSize: 11, color: "#64748b" }}>
            Admin: <code>ari@acme.test</code> · Employee: <code>noah@acme.test</code>
          </span>
        </div>
      </div>
    </div>
  );
}
