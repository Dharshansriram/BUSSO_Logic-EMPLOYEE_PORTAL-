import { Router } from "express";
import { ENV } from "../_core/env.js";
import {
  authenticateEmployee,
  createEmployeeSession,
  createPasswordReset,
  deleteEmployeeSession,
  getEmployeeBySession,
  getSessionToken,
  resetEmployeePassword,
  sessionCookieOptions,
} from "../core/auth.js";
import { recordAudit } from "../core/database.js";
import { asyncHandler, httpError, parseBody } from "../core/http.js";
import { activateAccount, inspectToken } from "../core/invites.js";
import { clear, count, hit, rateLimit } from "../core/rateLimit.js";
import {
  activateSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "../core/schemas.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);
    if (!email || !password)
      throw httpError(400, "Email and password are required");
    // Brute-force guard: 10 failed attempts / 15 min per IP+email.
    const failKey = `login:${req.ip}:${String(email).trim().toLowerCase()}`;
    if (count(failKey, 15 * 60_000) >= 10)
      throw httpError(429, "Too many attempts. Try again later.");
    const employee = await authenticateEmployee(email, password);
    if (!employee) {
      hit(failKey, 10, 15 * 60_000);
      throw httpError(401, "Invalid email or password");
    }
    clear(failKey);
    if (
      ENV.portalMode === "employee" &&
      employee.role !== "employee"
    ) {
      throw httpError(
        403,
        "Only employee accounts can access the Employee Portal."
      );
    }
    
    if (
      ENV.portalMode === "manager" &&
      !["manager", "admin"].includes(employee.role)
    ) {
      throw httpError(
        403,
        "Only managers and administrators can access the Manager Portal."
      );
    }
    const token = await createEmployeeSession(employee.id);
    res.cookie(ENV.sessionCookie, token, {
      ...sessionCookieOptions(req),
      maxAge: ENV.sessionTtlMs,
    });
    res.json({ employee }); // session token travels only in the httpOnly cookie
  })
);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const employee = await getEmployeeBySession(getSessionToken(req));
    if (!employee) throw httpError(401, "Not signed in");
    res.json({ employee });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await deleteEmployeeSession(getSessionToken(req));
    res.clearCookie(ENV.sessionCookie, sessionCookieOptions(req));
    res.json({ success: true });
  })
);

authRouter.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const email = parseBody(forgotPasswordSchema, req.body).email.trim();
    if (!email) throw httpError(400, "Email is required");
    const result = await createPasswordReset(email);
    res.json({
      success: true,
      message: "If the account exists, reset instructions have been created.",
      // The token is returned for local demos only; in production it would be emailed.
      resetToken: ENV.isProduction ? undefined : result.token,
    });
  })
);

authRouter.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const { token, password } = parseBody(resetPasswordSchema, req.body);
    if (!token || password.length < 8)
      throw httpError(
        400,
        "A valid token and password of at least 8 characters are required"
      );
    if (!(await resetEmployeePassword(token, password)))
      throw httpError(400, "Reset token is invalid or expired");
    res.json({ success: true });
  })
);

// ---- invitation activation (public; token-gated, rate limited) ---------------
const activationLimit = rateLimit("activation", 20, 15 * 60_000);

authRouter.post(
  "/activation/check",
  activationLimit,
  asyncHandler(async (req, res) => {
    const info = await inspectToken(req.body?.token);
    if (!info) throw httpError(400, "This activation link is invalid, expired, or already used.");
    res.json(info);
  })
);

authRouter.post(
  "/activate",
  activationLimit,
  asyncHandler(async (req, res) => {
    const { token, password, confirmPassword } = parseBody(activateSchema, req.body);
    const employee = await activateAccount(token, password, confirmPassword);
    await recordAudit(null, "activated", "employee", employee.id, `${employee.email} activated their account`);
    res.json({ success: true });
  })
);
