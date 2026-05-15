"use client";

import { StageView } from "@/components/StageView";

export type StageStatus = "pending" | "running" | "completed" | "failed";

export type StageState = {
  orderIdx: number;
  /** Internal stage identifier — used to dispatch to the right view + label */
  name: string;
  /** Internal model name (kept for /debug, never rendered in this component) */
  model: string;
  status: StageStatus;
  trace?: {
    parsedOutput: unknown;
    tokensIn: number;
    tokensOut: number;
    durationMs: number;
    costUsd: number;
    model: string;
  };
  errorMessage?: string;
};

/**
 * Customer-facing labels per stage. The internal `name` is engineering-speak
 * ("extract", "match"…) — these are what we actually show users. Description
 * gives one-line context for the pending/running state.
 */
const STAGE_LABELS: Record<
  string,
  { title: string; description: string }
> = {
  extract: {
    title: "Understanding your pitch",
    description: "Pulling out category, price tier, and positioning signals",
  },
  match: {
    title: "Finding publishers",
    description: "Scanning the catalog for the best audience fits",
  },
  personas: {
    title: "Picking audiences",
    description: "Identifying which shoppers will respond to this brand",
  },
  creative: {
    title: "Writing ad copy",
    description: "Drafting a tailored creative for each audience",
  },
  config: {
    title: "Building your campaign",
    description: "Assembling targeting, budget, and bid strategy",
  },
};

export const INITIAL_STAGES: ReadonlyArray<StageState> = [
  { orderIdx: 1, name: "extract", model: "haiku 4.5", status: "pending" },
  { orderIdx: 2, name: "match", model: "haiku 4.5", status: "pending" },
  { orderIdx: 3, name: "personas", model: "haiku 4.5", status: "pending" },
  { orderIdx: 4, name: "creative", model: "sonnet 4.6", status: "pending" },
  { orderIdx: 5, name: "config", model: "code", status: "pending" },
];

export function cloneInitialStages(): StageState[] {
  return INITIAL_STAGES.map((s) => ({ ...s }));
}

export function StageList({ stages }: { stages: StageState[] }) {
  return (
    <section className="mt-6 space-y-3">
      {stages.map((s) => (
        <StageCard key={s.orderIdx} stage={s} />
      ))}
    </section>
  );
}

function StageCard({ stage }: { stage: StageState }) {
  const label = STAGE_LABELS[stage.name] ?? {
    title: stage.name,
    description: "",
  };
  return (
    <article className="pl-fade-in overflow-hidden rounded-2xl border border-[#2a2620] bg-[#16140f]/70 backdrop-blur">
      <header className="flex items-center justify-between gap-3 border-b border-[#2a2620] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <StatusDot status={stage.status} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-[#ece8e0]">
              {label.title}
            </div>
            {label.description && (
              <div className="truncate text-xs text-[#6c665d]">
                {label.description}
              </div>
            )}
          </div>
        </div>
        <StatusMeta stage={stage} />
      </header>
      {stage.status === "completed" && stage.trace && (
        <StageView
          stageName={stage.name}
          parsedOutput={stage.trace.parsedOutput}
        />
      )}
      {stage.status === "failed" && (
        <div className="border-t border-red-900/40 bg-red-950/20 px-4 py-2.5 text-xs text-red-300">
          {stage.errorMessage ?? "Something went wrong on this step."}
        </div>
      )}
    </article>
  );
}

function StatusMeta({ stage }: { stage: StageState }) {
  if (stage.status === "pending") {
    return <span className="text-xs text-[#6c665d]">waiting</span>;
  }
  if (stage.status === "running") {
    return (
      <span className="text-xs text-[#e8b97c]">working…</span>
    );
  }
  if (stage.status === "completed" && stage.trace) {
    return (
      <span className="font-mono text-xs text-[#6c665d]">
        {formatDuration(stage.trace.durationMs)}
      </span>
    );
  }
  if (stage.status === "failed") {
    return <span className="text-xs text-red-400">failed</span>;
  }
  return null;
}

function formatDuration(ms: number): string {
  if (ms < 100) return "instant";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusDot({ status }: { status: StageStatus }) {
  const cls =
    status === "completed"
      ? "bg-emerald-400"
      : status === "running"
        ? "bg-[#e8b97c] animate-pulse"
        : status === "failed"
          ? "bg-red-400"
          : "bg-[#3a352d]";
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`}
    />
  );
}
