import { ENV } from "../_core/env.js";
import { sendMail } from "../_core/mailer.js";
import { createEmployee, getDb, publicEmployee } from "./database.js";
import { DEMO_EMPLOYEES } from "./demoData.js";
import { httpError } from "./http.js";
import { hashPassword, randomToken, sha256 } from "./passwords.js";

const HOUR = 3_600_000;
const GENERIC_INVALID = "This activation link is invalid, expired, or already used.";

// Password policy enforced server-side (max length also bounds scrypt cost).
export function checkPassword(password) {
  if (typeof password !== "string" || password.length < 10)
    return "Password must be at least 10 characters";
  if (password.length > 128) return "Password must be at most 128 characters";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Password must include letters and at least one number";
  return null;
}

const newInviteFields = () => {
  const token = randomToken(32); // 256 bits from crypto.randomBytes
  const expires = new Date(Date.now() + ENV.inviteTtlHours * HOUR);
  return {
    token,
    fields: {
      inviteTokenHash: sha256(token), // only the hash is stored
      inviteExpiresAt: expires.toISOString(),
      invitedAt: new Date().toISOString(),
    },
    expires,
  };
};

const esc = value =>
  String(value).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

export function buildInviteEmail({ name, link, expires, company = ENV.companyName }) {
  const when = expires.toUTCString();
  const hours = ENV.inviteTtlHours;
  const subject = `You're invited to ${company} – activate your account`;
  const text = `Hello ${name},

You have been invited to join ${company}.

Activate your account and choose your own password here:
${link}

This link is valid for ${hours} hours (expires ${when}) and can be used only once.

How to activate:
1. Open the link above.
2. Enter a new password and confirm it.
3. Sign in with this email address and your new password.

${company} will never ask for your password by email. If you did not expect this invitation, ignore this message.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a2233">
<h2 style="margin:0 0 12px">${esc(company)}</h2>
<p>Hello ${esc(name)},</p>
<p>You have been invited to join <b>${esc(company)}</b>. Activate your account and choose your own password.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#2457ff;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none">Activate my account</a></p>
<p style="font-size:13px;color:#555">Or paste this link into your browser:<br>${esc(link)}</p>
<p><b>This link is valid for ${hours} hours</b> (expires ${esc(when)}) and works only once.</p>
<ol><li>Open the link above.</li><li>Enter a new password and confirm it.</li><li>Sign in with this email address and your new password.</li></ol>
<p style="font-size:12px;color:#777">${esc(company)} will never ask for your password by email. If you did not expect this invitation, ignore this message.</p></div>`;
  return { subject, text, html };
}

async function deliver(employee, token, expires) {
  // Fragment (#) keeps the token out of server access logs and Referer headers.
  const link = `${ENV.employeePortalUrl}/activate#token=${token}`;
  return sendMail({
    to: employee.email, // exactly the address the manager entered (normalized to lowercase)
    ...buildInviteEmail({ name: employee.name, link, expires }),
  });
}

/** Create a pending employee and email the invitation. Throws 409 on duplicates. */
export async function inviteEmployee(data) {
  const { token, fields, expires } = newInviteFields();
  let employee;
  try {
    employee = await createEmployee(data, fields);
  } catch (error) {
    if (error.code === "DUPLICATE_EMAIL") throw httpError(409, error.message);
    throw error;
  }
  const mail = await deliver(employee, token, expires);
  return { employee, email: mail };
}

/** Issue a fresh token (invalidating the previous one) for a still-pending employee. */
export async function resendInvite(employeeId) {
  const { token, fields, expires } = newInviteFields();
  const database = await getDb();
  let employee;
  if (!database) {
    const doc = DEMO_EMPLOYEES.find(e => e.id === employeeId && e.status === "pending");
    if (doc) Object.assign(doc, fields);
    employee = doc;
  } else {
    employee = await database
      .collection("employees")
      .findOneAndUpdate(
        { id: employeeId, status: "pending" },
        { $set: fields },
        { returnDocument: "after" }
      );
  }
  if (!employee) throw httpError(409, "Only pending accounts can be re-invited");
  const mail = await deliver(employee, token, expires);
  return { employee: publicEmployee(employee), email: mail };
}

/** Public: is this token currently usable? Reveals nothing besides validity and the invitee's name. */
export async function inspectToken(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = sha256(token);
  const now = new Date();
  const database = await getDb();
  const employee = !database
    ? DEMO_EMPLOYEES.find(
        e =>
          e.inviteTokenHash === tokenHash &&
          e.status === "pending" &&
          new Date(e.inviteExpiresAt) > now
      )
    : await database.collection("employees").findOne({
        inviteTokenHash: tokenHash,
        status: "pending",
        inviteExpiresAt: { $gt: now.toISOString() },
      });
  return employee
    ? { name: employee.name, company: ENV.companyName, expiresAt: employee.inviteExpiresAt }
    : null;
}

/**
 * Public: set the password and activate. The token check, activation and token removal are
 * one atomic update, so a token can never be used twice (even by concurrent requests).
 */
export async function activateAccount(token, password, confirmPassword) {
  if (password !== confirmPassword) throw httpError(400, "Passwords do not match");
  const problem = checkPassword(password);
  if (problem) throw httpError(400, problem);
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw httpError(400, GENERIC_INVALID);

  const tokenHash = sha256(token);
  const now = new Date();
  const set = {
    passwordHash: hashPassword(password),
    status: "active",
    activatedAt: now.toISOString(),
    inviteTokenHash: null,
    inviteExpiresAt: null,
  };
  const database = await getDb();
  let employee;
  if (!database) {
    employee = DEMO_EMPLOYEES.find(
      e =>
        e.inviteTokenHash === tokenHash &&
        e.status === "pending" &&
        new Date(e.inviteExpiresAt) > now
    );
    if (employee) Object.assign(employee, set);
  } else {
    employee = await database.collection("employees").findOneAndUpdate(
      {
        inviteTokenHash: tokenHash,
        status: "pending",
        inviteExpiresAt: { $gt: now.toISOString() },
      },
      { $set: set },
      { returnDocument: "after" }
    );
  }
  if (!employee) throw httpError(400, GENERIC_INVALID);
  return publicEmployee(employee);
}
