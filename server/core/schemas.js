import { z } from "zod";

// Optional field with a default; treats null the same as "missing".
const withDefault = (schema, fallback) =>
  schema.nullish().transform(value => value ?? fallback);
const optional = schema =>
  schema.nullish().transform(value => value ?? undefined);

const str = z.string();
const int = z.coerce.number().int();
const num = z.coerce.number();

export const loginSchema = z.object({ email: str, password: str });
export const forgotPasswordSchema = z.object({ email: str });
export const resetPasswordSchema = z.object({ token: str, password: str });

export const activateSchema = z.object({
  token: str,
  password: str,
  confirmPassword: str,
});

export const taskStatusSchema = z.object({ status: str });
export const taskCreateSchema = z.object({
  title: str.trim().min(1, "title is required"),
  projectId: withDefault(int, 1),
  assignee: withDefault(str, "Maya Chen"),
  stage: withDefault(str, "Execution"),
  priority: withDefault(str, "medium"),
  estimatedHours: withDefault(num, 4),
  actualHours: withDefault(num, 0),
  dueAt: optional(str),
});

export const projectCreateSchema = z.object({
  name: str.trim().min(1, "name is required"),
  description: withDefault(str, ""),
  ownerName: withDefault(str, "Maya Chen"),
  progress: withDefault(int, 0),
  status: withDefault(str, "active"),
  dueAt: optional(str),
});

export const employeeCreateSchema = z.object({
  name: str,
  email: str,
  department: str,
  roleTitle: str,
  skills: str,
  capacityHours: withDefault(int, 40),
  role: withDefault(str, "employee"),
});
export const employeeRoleSchema = z.object({ role: str });

export const scheduleCreateSchema = z.object({
  employeeId: int,
  date: str,
  startTime: str,
  endTime: str,
  type: str,
  note: withDefault(str, ""),
  projectId: optional(int), // project-specific team schedule (visible to that project's team)
});

export const invitationCreateSchema = z.object({
  email: str,
  role: str,
  department: str,
  roleTitle: withDefault(str, ""),
});

export const workflowGenerateSchema = z.object({ prompt: str });
export const workflowCreateSchema = z.object({
  name: str,
  trigger: str,
  stages: z.array(str),
  description: withDefault(str, ""),
});

export const simulatorCompareSchema = z.object({
  interventionType: str,
  taskId: optional(int),
  targetAssignee: optional(str),
  priorityChange: optional(str),
  scheduleAdjustmentHours: withDefault(num, 0),
  notes: withDefault(str, ""),
});

export const copilotAskSchema = z.object({
  question: str,
  context: optional(z.record(z.string(), z.unknown())),
});

export const outcomeRecordSchema = z.object({
  recommendationId: optional(int),
  interventionType: str,
  actionTaken: str,
  decisionMaker: withDefault(str, "Current User"),
  predictedRiskDelta: withDefault(num, 0),
  actualOutcomeObserved: withDefault(str, ""),
  actualDelayHours: withDefault(num, 0),
  notes: withDefault(str, ""),
});
