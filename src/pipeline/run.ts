import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { CallResult } from "@/lib/claude";
import { runExtract } from "./extract";
import { runMatch } from "./match";
import { runPersonas } from "./personas";
import { runCreative } from "./creative";
import { runConfig } from "./config";
import type { CampaignConfig } from "@/schemas";

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
  finalConfig?: CampaignConfig;
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
  const traces: StageTrace[] = [];

  try {
    const extract = await executeStage({
      runId, orderIdx: 1, name: "extract",
      run: () => runExtract(pitch),
    });
    traces.push(extract.trace);

    const match = await executeStage({
      runId, orderIdx: 2, name: "match",
      run: () => runMatch(extract.parsed),
    });
    traces.push(match.trace);

    const personas = await executeStage({
      runId, orderIdx: 3, name: "personas",
      run: () => runPersonas(extract.parsed, match.parsed),
    });
    traces.push(personas.trace);

    const creative = await executeStage({
      runId, orderIdx: 4, name: "creative",
      run: () => runCreative(extract.parsed, personas.parsed),
    });
    traces.push(creative.trace);

    const config = await executeStage({
      runId, orderIdx: 5, name: "config",
      run: () => runConfig({
        extract: extract.parsed,
        match: match.parsed,
        personasPicked: personas.parsed,
        creatives: creative.parsed,
      }),
    });
    traces.push(config.trace);

    const totalCostUsd = traces.reduce((sum, s) => sum + s.costUsd, 0);
    const totalDurationMs = Date.now() - overallStarted;

    await db
      .update(schema.runs)
      .set({
        status: "completed",
        totalCostUsd,
        totalDurationMs,
        confidence: extract.parsed.confidence,
        finalConfig: config.parsed as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(schema.runs.id, runId));

    return {
      runId,
      pitch,
      status: "completed",
      stages: traces,
      totalCostUsd,
      totalDurationMs,
      finalConfig: config.parsed,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const totalDurationMs = Date.now() - overallStarted;
    const totalCostUsd = traces.reduce((sum, s) => sum + s.costUsd, 0);

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
      stages: traces,
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
}): Promise<{ trace: StageTrace; parsed: T }> {
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
      trace: {
        name: opts.name,
        orderIdx: opts.orderIdx,
        status: "completed",
        parsedOutput: r.parsed,
        model: r.model,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        durationMs: r.durationMs,
        costUsd: r.costUsd,
      },
      parsed: r.parsed,
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
