"use client";

import { StageView } from "@/components/StageView";

export type StageStatus = "pending" | "running" | "completed" | "failed";

export type StageState = {
  orderIdx: number;
  name: string;
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
  return (
    <article className="pl-fade-in overflow-hidden rounded-2xl border border-[#2a2620] bg-[#16140f]/70 backdrop-blur">
      <header className="flex items-center justify-between border-b border-[#2a2620] px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2.5">
          <StatusDot status={stage.status} />
          <span className="font-mono text-[#ece8e0]">
            stage 0{stage.orderIdx} · {stage.name}
          </span>
          <span className="rounded-full border border-[#2a2620] bg-[#0e0d0c] px-2 py-0.5 font-mono text-[10px] text-[#a8a195]">
            {stage.model}
          </span>
        </div>
        <div className="font-mono text-[11px] text-[#6c665d]">
          {stage.status === "pending" && "waiting"}
          {stage.status === "running" && "running…"}
          {stage.status === "completed" && stage.trace && (
            <>
              {stage.trace.durationMs} ms · {stage.trace.tokensIn}↓{" "}
              {stage.trace.tokensOut}↑ · ${stage.trace.costUsd.toFixed(6)}
            </>
          )}
          {stage.status === "failed" && (
            <span className="text-red-400">failed</span>
          )}
        </div>
      </header>
      {stage.status === "completed" && stage.trace && (
        <StageView
          stageName={stage.name}
          parsedOutput={stage.trace.parsedOutput}
        />
      )}
      {stage.status === "failed" && (
        <div className="border-t border-red-900/40 bg-red-950/20 px-4 py-2.5 text-xs text-red-300">
          {stage.errorMessage ?? "Stage failed without a message."}
        </div>
      )}
    </article>
  );
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
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}
