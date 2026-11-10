import "dotenv/config";
import { MongoClient } from "mongodb";
import { hashPassword } from "../server/core/passwords.js";

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "test";
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!uri || !email || !password || password.length < 12) {
    throw new Error(
      "Configure MONGODB_URI, BOOTSTRAP_ADMIN_EMAIL, and a password of at least 12 characters in .env."
    );
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();

    const db = client.db(
      (() => {
        const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/.exec(uri);
        return match?.[1] || dbName;
      })()
    );

    await db.command({ ping: 1 });

    const employees = db.collection("employees");
    const existing = await employees.findOne({ email });

    const credentials = {
      passwordHash: hashPassword(password),
      role: "admin",
      status: "active",
    };

    if (existing) {
      await employees.updateOne({ _id: existing._id }, { $set: credentials });
      console.log(`Updated admin account: ${email}`);
    } else {
      const latest = await employees.findOne(
        {},
        { sort: { id: -1 }, projection: { id: 1 } }
      );

      await employees.insertOne({
        id: (latest?.id ?? 0) + 1,
        name: "System Administrator",
        email,
        ...credentials,
        department: "Administration",
        roleTitle: "System Administrator",
        capacityHours: 40,
        availability: "available",
        skills: "administration",
        createdAt: new Date().toISOString(),
      });

      console.log(`Created admin account: ${email}`);
    }

    console.log(`Database connected: ${db.databaseName}`);
  } finally {
    await client.close();
  }
}

main().catch(error => {
  console.error("Admin seeding failed:", error.message);
  process.exitCode = 1;
});
