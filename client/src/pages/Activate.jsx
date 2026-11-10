import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

// Public page opened from the invitation email: /activate#token=...
const readToken = () => {
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
  return fromHash || new URLSearchParams(window.location.search).get("token") || "";
};

export default function Activate() {
  const [token] = useState(readToken);
  const [state, setState] = useState("checking"); // checking | ready | invalid | done
  const [info, setInfo] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Remove the token from the address bar/history once read.
    if (window.location.hash || window.location.search) window.history.replaceState(null, "", "/activate");
    if (!token) return setState("invalid");
    api.checkActivation(token).then(i => { setInfo(i); setState("ready"); }).catch(() => setState("invalid"));
  }, [token]);

  const submit = async e => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    try { await api.activateAccount(token, password, confirm); setState("done"); }
    catch (err) { setError(err.message); if (/invalid, expired|already used/i.test(err.message)) setState("invalid"); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand login-brand"><div className="brand-mark">BL</div><div><b>BUSSOLOGIC</b><small>Account activation</small></div></div>
        {state === "checking" && <p>Checking your activation link…</p>}
        {state === "invalid" && (<>
          <h1>Link not valid</h1>
          <div className="auth-error">This activation link is invalid, expired, or has already been used.</div>
          <p>Ask your manager to resend your invitation, or <a href="/">sign in</a> if you already activated your account.</p>
        </>)}
        {state === "ready" && (<>
          <h1>Welcome, {info.name}</h1>
          <p>Choose a password to activate your {info.company} account.</p>
          {error && <div className="auth-error">{error}</div>}
          <form className="activation-form" onSubmit={submit}>
            <label className="activation-field">New password<input className="activation-input" type="password" required minLength={10} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
            <label className="activation-field">Confirm password<input className="activation-input" type="password" required minLength={10} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
            <small className="activation-hint">At least 10 characters, with letters and a number.</small>
            <button className="primary-button full activation-submit" disabled={loading}>{loading ? "Activating…" : "Activate account"}</button>
          </form>
        </>)}
        {state === "done" && (<>
          <h1>Account activated</h1>
          <div className="success-banner">Your password is set. You can now sign in with your email and password.</div>
          <a className="primary-button full" href="/" style={{ display: "block", textAlign: "center" }}>Go to sign in</a>
        </>)}
      </div>
    </div>
  );
}
