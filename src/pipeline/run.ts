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

export type PipelineEvent =
  | { type: "run_started"; runId: string }
  | { type: "stage_start"; orderIdx: number; name: StageName }
  | { type: "stage_complete"; trace: StageTrace }
  | {
      type: "stage_failed";
      orderIdx: number;
      name: StageName;
      errorMessage: string;
    }
  | {
      type: "run_complete";
      runId: string;
      totalCostUsd: number;
      totalDurationMs: number;
      finalConfig: CampaignConfig;
    }
  | { type: "run_failed"; runId: string; errorMessage: string };

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

export async function* runPipelineStream(
  pitch: string,
): AsyncGenerator<PipelineEvent, void, void> {
  const db = getDb();
  const overallStarted = Date.now();
  const traces: StageTrace[] = [];

  let currentStage: { orderIdx: number; name: StageName } | null = null;
  let runId: string | null = null;

  try {
    const inserted = await db
      .insert(schema.runs)
      .values({ pitch, status: "running" })
      .returning({ id: schema.runs.id });
    const runRow = inserted[0];
    if (!runRow) throw new Error("Failed to create run row");
    runId = runRow.id;
    yield { type: "run_started", runId };

    // STAGE 1
    currentStage = { orderIdx: 1, name: "extract" };
    yield { type: "stage_start", ...currentStage };
    const extract = await executeStage({
      runId, ...currentStage,
      run: () => runExtract(pitch),
    });
    traces.push(extract.trace);
    yield { type: "stage_complete", trace: extract.trace };

    // STAGE 2
    currentStage = { orderIdx: 2, name: "match" };
    yield { type: "stage_start", ...currentStage };
    const match = await executeStage({
      runId, ...currentStage,
      run: () => runMatch(extract.parsed),
    });
    traces.push(match.trace);
    yield { type: "stage_complete", trace: match.trace };

    // STAGE 3
    currentStage = { orderIdx: 3, name: "personas" };
    yield { type: "stage_start", ...currentStage };
    const personas = await executeStage({
      runId, ...currentStage,
      run: () => runPersonas(extract.parsed, match.parsed),
    });
    traces.push(personas.trace);
    yield { type: "stage_complete", trace: personas.trace };

    // STAGE 4
    currentStage = { orderIdx: 4, name: "creative" };
    yield { type: "stage_start", ...currentStage };
    const creative = await executeStage({
      runId, ...currentStage,
      run: () => runCreative(extract.parsed, personas.parsed),
    });
    traces.push(creative.trace);
    yield { type: "stage_complete", trace: creative.trace };

    // STAGE 5
    currentStage = { orderIdx: 5, name: "config" };
    yield { type: "stage_start", ...currentStage };
    const config = await executeStage({
      runId, ...currentStage,
      run: () =>
        runConfig({
          extract: extract.parsed,
          match: match.parsed,
          personasPicked: personas.parsed,
          creatives: creative.parsed,
        }),
    });
    traces.push(config.trace);
    yield { type: "stage_complete", trace: config.trace };

    currentStage = null;

    const totalCostUsd = traces.reduce((s, t) => s + t.costUsd, 0);
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

    yield {
      type: "run_complete",
      runId,
      totalCostUsd,
      totalDurationMs,
      finalConfig: config.parsed,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (currentStage) {
      yield { type: "stage_failed", ...currentStage, errorMessage };
    }
    if (runId) {
      const totalCostUsd = traces.reduce((s, t) => s + t.costUsd, 0);
      const totalDurationMs = Date.now() - overallStarted;
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
      yield { type: "run_failed", runId, errorMessage };
    }
  }
}

export async function runPipeline(pitch: string): Promise<RunResult> {
  const traces: StageTrace[] = [];
  let runId = "";
  let finalConfig: CampaignConfig | undefined;
  let errorMessage: string | undefined;
  let totalCostUsd = 0;
  let totalDurationMs = 0;
  let status: "completed" | "failed" = "failed";

  for await (const ev of runPipelineStream(pitch)) {
    switch (ev.type) {
      case "run_started":
        runId = ev.runId;
        break;
      case "stage_complete":
        traces.push(ev.trace);
        break;
      case "run_complete":
        status = "completed";
        totalCostUsd = ev.totalCostUsd;
        totalDurationMs = ev.totalDurationMs;
        finalConfig = ev.finalConfig;
        break;
      case "run_failed":
        status = "failed";
        errorMessage = ev.errorMessage;
        break;
      case "stage_failed":
        errorMessage = ev.errorMessage;
        break;
      default:
        break;
    }
  }

  return {
    runId,
    pitch,
    status,
    stages: traces,
    totalCostUsd,
    totalDurationMs,
    ...(finalConfig !== undefined ? { finalConfig } : {}),
    ...(errorMessage !== undefined ? { errorMessage } : {}),
  };
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
