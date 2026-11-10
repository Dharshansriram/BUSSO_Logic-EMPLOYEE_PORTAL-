import { ENV } from "./env.js";

// Provider-agnostic SMTP mailer (Gmail app password, SendGrid, Brevo, SES, Mailgun...).
// nodemailer is loaded lazily so the API still boots if it is not installed.
let transport; // cached; tests can inject one with setMailTransport()

export const mailConfigured = () =>
  Boolean(transport || (ENV.smtpHost && ENV.smtpUser && ENV.smtpPass && ENV.mailFrom));

export const setMailTransport = value => {
  transport = value;
};

async function getTransport() {
  if (transport) return transport;
  if (!mailConfigured()) return null;
  const { default: nodemailer } = await import("nodemailer");
  transport = nodemailer.createTransport({
    host: ENV.smtpHost,
    port: ENV.smtpPort,
    secure: ENV.smtpSecure,
    auth: { user: ENV.smtpUser, pass: ENV.smtpPass },
  });
  return transport;
}

/** Returns { sent: boolean, reason?: string }. Never throws, never logs credentials or message bodies. */
export async function sendMail({ to, subject, text, html }) {
  try {
    const mailer = await getTransport();
    if (!mailer) return { sent: false, reason: "Email provider is not configured" };
    await mailer.sendMail({ from: ENV.mailFrom, to, subject, text, html });
    return { sent: true };
  } catch (error) {
    console.warn("[mail] delivery failed:", error?.code ?? error?.name ?? "error");
    return { sent: false, reason: "Email provider rejected or could not send the message" };
  }
}
