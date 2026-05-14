"use client";

import { useState } from "react";

type StageStatus = "pending" | "running" | "completed" | "failed";

type StageState = {
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

type RunMeta = { totalCostUsd: number; totalDurationMs: number };

const INITIAL_STAGES: ReadonlyArray<StageState> = [
  { orderIdx: 1, name: "extract", model: "haiku 4.5", status: "pending" },
  { orderIdx: 2, name: "match", model: "haiku 4.5", status: "pending" },
  { orderIdx: 3, name: "personas", model: "haiku 4.5", status: "pending" },
  { orderIdx: 4, name: "creative", model: "sonnet 4.6", status: "pending" },
  { orderIdx: 5, name: "config", model: "code", status: "pending" },
];

function cloneStages(): StageState[] {
  return INITIAL_STAGES.map((s) => ({ ...s }));
}

async function* parseSseStream(
  response: Response,
): AsyncGenerator<{ type: string; data: Record<string, unknown> }, void, void> {
  if (!response.body) return;
  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        let eventType = "message";
        let dataParts: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) eventType = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataParts.push(line.slice(6));
        }
        const data = dataParts.join("\n");
        if (data) {
          try {
            yield { type: eventType, data: JSON.parse(data) };
          } catch {
            /* malformed line — ignore */
          }
        }
        sep = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export default function Home() {
  const [pitch, setPitch] = useState("");
  const [stages, setStages] = useState<StageState[]>(cloneStages());
  const [runId, setRunId] = useState<string | null>(null);
  const [runMeta, setRunMeta] = useState<RunMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function patchStage(orderIdx: number, patch: Partial<StageState>) {
    setStages((prev) =>
      prev.map((s) => (s.orderIdx === orderIdx ? { ...s, ...patch } : s)),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRunId(null);
    setRunMeta(null);
    setStages(cloneStages());

    try {
      const resp = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pitch }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        try {
          const json = JSON.parse(text);
          setError(json.error ?? `HTTP ${resp.status}`);
        } catch {
          setError(`HTTP ${resp.status}: ${text}`);
        }
        return;
      }

      for await (const ev of parseSseStream(resp)) {
        const d = ev.data;
        switch (ev.type) {
          case "run_started":
            if (typeof d.runId === "string") setRunId(d.runId);
            break;
          case "stage_start":
            if (typeof d.orderIdx === "number") {
              patchStage(d.orderIdx, { status: "running" });
            }
            break;
          case "stage_complete": {
            const trace = d.trace as StageState["trace"] & { orderIdx: number };
            if (trace && typeof trace.orderIdx === "number") {
              patchStage(trace.orderIdx, { status: "completed", trace });
            }
            break;
          }
          case "stage_failed":
            if (typeof d.orderIdx === "number") {
              patchStage(d.orderIdx, {
                status: "failed",
                errorMessage:
                  typeof d.errorMessage === "string" ? d.errorMessage : "Stage failed",
              });
            }
            break;
          case "run_complete":
            if (
              typeof d.totalCostUsd === "number" &&
              typeof d.totalDurationMs === "number"
            ) {
              setRunMeta({
                totalCostUsd: d.totalCostUsd,
                totalDurationMs: d.totalDurationMs,
              });
            }
            break;
          case "run_failed":
            setError(
              typeof d.errorMessage === "string" ? d.errorMessage : "Run failed",
            );
            break;
          case "error":
            setError(typeof d.message === "string" ? d.message : "Stream error");
            break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stream failed");
    } finally {
      setLoading(false);
    }
  }

  const anyActivity = stages.some((s) => s.status !== "pending");

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Disco</h1>
        <a
          href="/debug"
          className="font-mono text-xs text-neutral-400 hover:text-white"
        >
          /debug →
        </a>
      </div>
      <p className="mt-3 text-sm text-neutral-400">
        Paste a one-sentence advertiser pitch. The 5-stage pipeline streams its progress as it runs.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3">
        <textarea
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          rows={4}
          placeholder="e.g. We sell premium dog food for senior dogs, targeting owners who care about joint health and longevity."
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
          disabled={loading}
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || pitch.trim().length < 3}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            {loading ? "Streaming…" : "Run pipeline"}
          </button>
          {runId && (
            <span className="font-mono text-xs text-neutral-500">
              run · {runId.slice(0, 8)}
            </span>
          )}
        </div>
      </form>

      {error && (
        <div className="mt-6 rounded-md border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          <div className="font-medium">Error</div>
          <div className="mt-1 text-red-200/80">{error}</div>
        </div>
      )}

      {anyActivity && (
        <section className="mt-8 space-y-3">
          {stages.map((s) => (
            <StageCard key={s.orderIdx} stage={s} />
          ))}
        </section>
      )}

      {runMeta && (
        <footer className="mt-6 flex items-center justify-between border-t border-neutral-800 pt-4 text-xs text-neutral-400">
          <span>
            Total — <span className="font-mono">{(runMeta.totalDurationMs / 1000).toFixed(2)}s</span> ·{" "}
            <span className="font-mono">${runMeta.totalCostUsd.toFixed(4)}</span>
          </span>
          <span className="font-mono text-neutral-500">pipeline complete</span>
        </footer>
      )}
    </main>
  );
}

function StageCard({ stage }: { stage: StageState }) {
  return (
    <article className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2.5">
          <StatusDot status={stage.status} />
          <span className="font-mono text-neutral-400">
            stage 0{stage.orderIdx} · {stage.name}
          </span>
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
            {stage.model}
          </span>
        </div>
        <div className="font-mono text-[11px] text-neutral-500">
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
        <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed text-neutral-200">
          {JSON.stringify(stage.trace.parsedOutput, null, 2)}
        </pre>
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
        ? "bg-amber-400 animate-pulse"
        : status === "failed"
          ? "bg-red-400"
          : "bg-neutral-700";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}
