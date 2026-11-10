// Minimal collection helper shared by the portal routes. Uses MongoDB when connected,
// otherwise the same in-memory arrays the rest of the server already falls back to.
import { getDb, publicEmployee, rows, strip } from "./database.js";
import {
  DEMO_ALERTS,
  DEMO_EMPLOYEES,
  DEMO_PROJECTS,
  DEMO_SCHEDULES,
  DEMO_TASKS,
  fallbackNotifications,
  fallbackOutcomes,
  fallbackSimulations,
  fallbackWorkflows,
} from "./demoData.js";

const MEM = {
  tasks: DEMO_TASKS,
  employees: DEMO_EMPLOYEES,
  projects: DEMO_PROJECTS,
  schedules: DEMO_SCHEDULES,
  alerts: DEMO_ALERTS,
  notifications: fallbackNotifications,
  outcomes: fallbackOutcomes,
  simulations: fallbackSimulations,
  workflows: fallbackWorkflows,
  task_updates: [],
  proposals: [],
  feedback: [],
};

const matches = (doc, filter) =>
  Object.entries(filter).every(([key, value]) => doc[key] === value);
const clean = (name, doc) =>
  name === "employees" ? publicEmployee(doc) : strip(doc);

export async function find(name, filter = {}) {
  const db = await getDb();
  if (!db) return MEM[name].filter(d => matches(d, filter)).map(d => clean(name, d));
  const col = db.collection(name);
  let docs = await col.find(filter).sort({ id: 1 }).limit(2000).toArray();
  if (!docs.length && name === "workflows" && !Object.keys(filter).length) {
    await col.insertMany(structuredClone(fallbackWorkflows)); // seed once
    docs = await col.find({}).sort({ id: 1 }).toArray();
  }
  return name === "employees" ? docs.map(publicEmployee) : rows(docs);
}

export const findOne = async (name, filter) =>
  (await find(name, filter))[0] ?? null;

export async function nextId(name) {
  const db = await getDb();
  if (db) {
    const last = await db
      .collection(name)
      .findOne({}, { sort: { id: -1 }, projection: { id: 1 } });
    return (last?.id ?? 0) + 1;
  }
  return Math.max(0, ...MEM[name].map(d => d.id ?? 0)) + 1;
}

export async function insert(name, doc) {
  const full = {
    createdAt: new Date().toISOString(),
    ...doc,
    id: doc.id ?? (await nextId(name)),
  };
  const db = await getDb();
  if (db) await db.collection(name).insertOne({ ...full });
  else MEM[name].push(full);
  return full;
}

export async function patch(name, id, set) {
  const update = { ...set, updatedAt: new Date().toISOString() };
  const db = await getDb();
  if (db) {
    const doc = await db
      .collection(name)
      .findOneAndUpdate({ id }, { $set: update }, { returnDocument: "after" });
    return clean(name, doc);
  }
  const doc = MEM[name].find(d => d.id === id);
  if (!doc) return null;
  Object.assign(doc, update);
  return clean(name, doc);
}
