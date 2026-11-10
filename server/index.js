import { createServer } from "node:http";
import { ENV } from "./_core/env.js";
import { createApp } from "./app.js";
import { closeDb, getDb } from "./core/database.js";

// Employee Portal API. It shares MongoDB (MONGODB_URI / MONGODB_DB) with the Manager Portal but never seeds
// or migrates data: the Manager Portal server owns that.
async function start() {
  try {
    await getDb();
  } catch (error) {
    console.warn("Database startup notice:", error.message);
  }
  const server = createServer(createApp());
  server.listen(ENV.port, ENV.host, () =>
    console.log(`Employee Portal API running on http://localhost:${ENV.port}`)
  );
  const shutdown = async () => {
    server.close();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch(error => {
  console.error(error);
  process.exit(1);
});
