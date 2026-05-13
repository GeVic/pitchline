import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const runStatusEnum = pgEnum("run_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const stageStatusEnum = pgEnum("stage_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const stageNameEnum = pgEnum("stage_name", [
  "extract",
  "match",
  "personas",
  "creative",
  "config",
]);

/**
 * One row per pipeline execution.
 * Holds top-level metadata + the final campaign config once stage 5 finishes.
 */
export const runs = pgTable("runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  pitch: text("pitch").notNull(),
  status: runStatusEnum("status").default("pending").notNull(),
  finalConfig: jsonb("final_config"),
  confidence: real("confidence"),
  errorMessage: text("error_message"),
  totalCostUsd: real("total_cost_usd"),
  totalDurationMs: integer("total_duration_ms"),
});

/**
 * One row per stage executed. The trace surface for /debug/[runId].
 * prompt, rawResponse, parsedOutput together let you reproduce or diff a stage.
 */
export const stages = pgTable("stages", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  orderIdx: integer("order_idx").notNull(),
  stageName: stageNameEnum("stage_name").notNull(),
  status: stageStatusEnum("status").default("pending").notNull(),
  prompt: text("prompt"),
  rawResponse: text("raw_response"),
  parsedOutput: jsonb("parsed_output"),
  model: text("model"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  durationMs: integer("duration_ms"),
  costUsd: real("cost_usd"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type Stage = typeof stages.$inferSelect;
export type NewStage = typeof stages.$inferInsert;
