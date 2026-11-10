import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";

process.env.MONGODB_URI = "mongodb://127.0.0.1:1/employee_portal_test"; // in-memory fallback

let server, base, cookie;
const call = async (method, path, body) => {
  const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})), res };
};
beforeAll(async () => {
  const { createApp } = await import("../app.js");
  server = createServer(createApp());
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  const r = await call("POST", "/api/auth/login", { email: "noah@acme.test", password: "Welcome123!" });
  cookie = r.res.headers.get("set-cookie").split(";")[0];
});
afterAll(() => server.close());

describe("employee portal API surface", () => {
  it("serves /me data and schedule/team scoped to the employee", async () => {
    expect((await call("GET", "/api/me/tasks")).status).toBe(200);
    const s = (await call("GET", "/api/me/schedule")).data;
    expect(Array.isArray(s.blocks)).toBe(true);
    expect(JSON.stringify(s.teams)).not.toMatch(/@/); // no teammate emails
  });
  it("does not expose manager or admin endpoints at all", async () => {
    for (const p of ["/api/manager/overview", "/api/manager/live", "/api/people", "/api/dashboard", "/api/workflows"])
      expect((await call("GET", p)).status).toBe(404);
  });
});
