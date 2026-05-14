import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { CallResult } from "@/lib/claude";
import { runExtract } from "./extract";
import type { Extract } from "@/schemas";

type StageName = (typeof schema.stageNameEnum.enumValues)[number];

export type StageTrace = {
  name: StageName;
  orderIdx: number;
  status: "completed" | "failed";
  parsedOutput: unknown;
  model: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  costUsd: number;
  errorMessage?: string;
};

export type RunResult = {
  runId: string;
  pitch: string;
  status: "completed" | "failed";
  stages: StageTrace[];
  totalCostUsd: number;
  totalDurationMs: number;
  errorMessage?: string;
};

export async function runPipeline(pitch: string): Promise<RunResult> {
  const db = getDb();
  const inserted = await db
    .insert(schema.runs)
    .values({ pitch, status: "running" })
    .returning({ id: schema.runs.id });
  const runRow = inserted[0];
  if (!runRow) throw new Error("Failed to create run row");

  const runId = runRow.id;
  const overallStarted = Date.now();
  const stages: StageTrace[] = [];

  try {
    const extract = await executeStage({
      runId,
      orderIdx: 1,
      name: "extract",
      run: () => runExtract(pitch),
    });
    stages.push(extract);

    // Stages 2–5 land in build sequence step 4.

    const totalCostUsd = stages.reduce((sum, s) => sum + s.costUsd, 0);
    const totalDurationMs = Date.now() - overallStarted;
    const confidence = (extract.parsedOutput as Extract).confidence;

    await db
      .update(schema.runs)
      .set({
        status: "completed",
        totalCostUsd,
        totalDurationMs,
        confidence,
        updatedAt: new Date(),
      })
      .where(eq(schema.runs.id, runId));

    return {
      runId,
      pitch,
      status: "completed",
      stages,
      totalCostUsd,
      totalDurationMs,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const totalDurationMs = Date.now() - overallStarted;
    const totalCostUsd = stages.reduce((sum, s) => sum + s.costUsd, 0);

    await db
      .update(schema.runs)
      .set({
        status: "failed",
        errorMessage,
        totalCostUsd,
        totalDurationMs,
        updatedAt: new Date(),
      })
      .where(eq(schema.runs.id, runId));

    return {
      runId,
      pitch,
      status: "failed",
      stages,
      totalCostUsd,
      totalDurationMs,
      errorMessage,
    };
  }
}

async function executeStage<T>(opts: {
  runId: string;
  orderIdx: number;
  name: StageName;
  run: () => Promise<CallResult<T>>;
}): Promise<StageTrace> {
  const db = getDb();
  const inserted = await db
    .insert(schema.stages)
    .values({
      runId: opts.runId,
      orderIdx: opts.orderIdx,
      stageName: opts.name,
      status: "running",
    })
    .returning({ id: schema.stages.id });
  const stageRow = inserted[0];
  if (!stageRow) throw new Error("Failed to insert stage row");

  try {
    const r = await opts.run();
    await db
      .update(schema.stages)
      .set({
        status: "completed",
        prompt: r.prompt,
        rawResponse: r.raw,
        parsedOutput: r.parsed as unknown as Record<string, unknown>,
        model: r.model,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        durationMs: r.durationMs,
        costUsd: r.costUsd,
        completedAt: new Date(),
      })
      .where(eq(schema.stages.id, stageRow.id));

    return {
      name: opts.name,
      orderIdx: opts.orderIdx,
      status: "completed",
      parsedOutput: r.parsed,
      model: r.model,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      durationMs: r.durationMs,
      costUsd: r.costUsd,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await db
      .update(schema.stages)
      .set({ status: "failed", errorMessage, completedAt: new Date() })
      .where(eq(schema.stages.id, stageRow.id));
    throw err;
  }
}
