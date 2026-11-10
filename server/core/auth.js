import { ENV } from "../_core/env.js";
import { getDb, publicEmployee } from "./database.js";
import {
  DEMO_EMPLOYEES,
  DEMO_PASSWORD,
  fallbackResetTokens,
  fallbackSessions,
} from "./demoData.js";
import {
  hashPassword,
  randomToken,
  sha256,
  verifyPassword,
} from "./passwords.js";
import { asyncHandler, httpError } from "./http.js";

const PRESENCE_INTERVAL_MS = 30_000;

// ---- credentials -----------------------------------------------------------
export async function authenticateEmployee(email, password) {
  const normalized = String(email).trim().toLowerCase();
  const database = await getDb();

  if (!database) {
    const employee = DEMO_EMPLOYEES.find(
      item => item.email.toLowerCase() === normalized
    );
    if (!employee || (employee.status ?? "active") !== "active") return null;
    // Employees without a stored hash are the untouched demo accounts.
    const ok = employee.passwordHash
      ? verifyPassword(password, employee.passwordHash)
      : password === DEMO_PASSWORD;
    return ok ? publicEmployee(employee) : null;
  }

  const employee = await database
    .collection("employees")
    .findOne({ email: normalized });
  // Accounts without a status predate invitations and are active.
  if (
    !employee ||
    (employee.status ?? "active") !== "active" ||
    !verifyPassword(password, employee.passwordHash)
  )
    return null;
  return publicEmployee(employee);
}

// ---- sessions --------------------------------------------------------------
export async function createEmployeeSession(employeeId) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ENV.sessionTtlMs);
  const database = await getDb();

  if (!database) {
    fallbackSessions.set(token, { employeeId, expiresAt: expiresAt.getTime() });
    return token;
  }
  const now = new Date();
  await database.collection("sessions").insertOne({
    tokenHash: sha256(token),
    employeeId,
    portal: ENV.portalMode,
    createdAt: now,
    lastSeenAt: now, // presence heartbeat read by the IntelliFlow manager monitor
    expiresAt,
  });
  return token;
}

export async function getEmployeeBySession(token) {
  if (!token) return null;
  const database = await getDb();

  if (!database) {
    const session = fallbackSessions.get(token);
    if (!session || session.expiresAt < Date.now()) return null;
    return publicEmployee(
      DEMO_EMPLOYEES.find(item => item.id === session.employeeId)
    );
  }

  const tokenHash = sha256(token);
  const session = await database
    .collection("sessions")
    .findOne({ tokenHash,portal: ENV.portalMode, expiresAt: { $gt: new Date() } });
  if (!session) return null;

  // At most one presence write per 30 s per session.
  const seen = session.lastSeenAt ? new Date(session.lastSeenAt).getTime() : 0;
  if (Date.now() - seen > PRESENCE_INTERVAL_MS) {
    database
      .collection("sessions")
      .updateOne({ tokenHash }, { $set: { lastSeenAt: new Date() } })
      .catch(() => {});
  }
  return publicEmployee(
    await database.collection("employees").findOne({ id: session.employeeId })
  );
}

export async function deleteEmployeeSession(token) {
  if (!token) return;
  const database = await getDb();
  if (!database) fallbackSessions.delete(token);
  else
    await database
      .collection("sessions")
      .deleteOne({ tokenHash: sha256(token) });
}

// ---- password reset --------------------------------------------------------
export async function createPasswordReset(email) {
  const token = randomToken(24);
  const normalized = String(email).trim().toLowerCase();
  const database = await getDb();

  if (!database) {
    const target = DEMO_EMPLOYEES.find(e => e.email.toLowerCase() === normalized);
    if (target && (target.status ?? "active") !== "active") return { token, email: normalized };
    fallbackResetTokens.set(token, {
      email: normalized,
      expiresAt: Date.now() + 3_600_000,
    });
  } else {
    await database
      .collection("employees")
      .updateOne(
        { email: normalized, status: { $in: [null, "active"] } },
        {
          $set: {
            resetTokenHash: sha256(token),
            resetTokenExpiresAt: new Date(Date.now() + 3_600_000),
          },
        }
      );
  }
  return { token, email: normalized };
}

export async function resetEmployeePassword(token, newPassword) {
  const database = await getDb();
  const passwordHash = hashPassword(newPassword);

  if (!database) {
    const request = fallbackResetTokens.get(token);
    if (!request || request.expiresAt < Date.now()) return false;
    const employee = DEMO_EMPLOYEES.find(
      item => item.email.toLowerCase() === request.email
    );
    if (!employee) return false;
    employee.passwordHash = passwordHash;
    fallbackResetTokens.delete(token);
    return true;
  }

  const result = await database
    .collection("employees")
    .updateOne(
      {
        resetTokenHash: sha256(token),
        resetTokenExpiresAt: { $gt: new Date() },
      },
      {
        $set: { passwordHash, resetTokenHash: null, resetTokenExpiresAt: null },
      }
    );
  return result.modifiedCount > 0;
}

// ---- Express middleware ----------------------------------------------------
export function getSessionToken(req) {
  const cookieHeader = req.headers.cookie || "";
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === ENV.sessionCookie) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer "))
    return authorization.slice(7).trim();
  return null;
}

export const sessionCookieOptions = req => ({
  httpOnly: true,
  sameSite: "lax",
  secure:
    req.secure ||
    String(req.headers["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim() === "https",
  path: "/",
});

export const requireEmployee = asyncHandler(async (req, _res, next) => {
  const employee = await getEmployeeBySession(getSessionToken(req));
  if (!employee) throw httpError(401, "Authentication required");
  req.employee = employee;
  next();
});

export const requireManager = (req, _res, next) =>
  ["manager", "admin"].includes(req.employee?.role)
    ? next()
    : next(httpError(403, "Manager or admin access required"));

export const requireAdmin = (req, _res, next) =>
  req.employee?.role === "admin"
    ? next()
    : next(httpError(403, "Admin access required"));
