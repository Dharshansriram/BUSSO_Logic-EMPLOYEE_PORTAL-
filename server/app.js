import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENV } from "./_core/env.js";
import { registerStorageProxy } from "./_core/storageProxy.js";
import { getDb, mongoStatus } from "./core/database.js";
import { requireEmployee } from "./core/auth.js";
import { subscribe } from "./core/events.js";
import { asyncHandler, errorHandler, httpError, notFoundHandler } from "./core/http.js";
import { authRouter } from "./routes/auth.js";
import { portalRouter } from "./routes/portal.js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: ENV.corsOrigins, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  registerStorageProxy(app);

  app.get(
    "/api/health",
    asyncHandler(async (_req, res) => {
      await getDb();
      res.json({
        status: "healthy",
        storage: mongoStatus(),
        platform: "Employee Portal",
        version: "1.0.0",
      });
    })
  );

  app.use("/api/auth", authRouter);
  app.get("/api/events", requireEmployee, subscribe);
  app.use("/api/manager", (_req, _res, next) => next(httpError(404, "Not found"))); // manager tools live in the Manager Portal only
  app.use("/api", portalRouter);
  app.use("/api", notFoundHandler);

  // Production: serve the built React client (npm run build -> dist/public).
  const distPath = path.join(projectRoot, "dist", "public");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (_req, res) =>
      res.sendFile(path.join(distPath, "index.html"))
    );
  } else {
    app.get("/", (_req, res) =>
      res.json({ name: "Employee Portal API", health: "/api/health" })
    );
  }

  app.use(errorHandler);
  return app;
}
