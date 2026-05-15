"use client";

import { useEffect, useRef, useState } from "react";
import { StageView } from "@/components/StageView";

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

const EXAMPLE_PITCHES: { label: string; pitch: string }[] = [
  {
    label: "Confident",
    pitch:
      "We sell premium dog food for senior dogs, targeting owners who care about joint health and longevity. Grain-free, vet-formulated, subscription-based.",
  },
  {
    label: "Niche / B2B",
    pitch: "B2B SaaS for dental practices. We automate their patient recall workflow.",
  },
  {
    label: "Vague",
    pitch: "We help people feel better.",
  },
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
  const abortRef = useRef<AbortController | null>(null);

  function patchStage(orderIdx: number, patch: Partial<StageState>) {
    setStages((prev) =>
      prev.map((s) => (s.orderIdx === orderIdx ? { ...s, ...patch } : s)),
    );
  }

  // Cancel any in-flight stream when the page unmounts (route change, tab close, etc.)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Browser-level guard for back / refresh / tab-close while a run is in flight.
  useEffect(() => {
    if (!loading) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Abort any previous in-flight stream (a re-submission supersedes the prior run client-side).
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

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
        signal: controller.signal,
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
      // Intentional aborts (unmount, navigation confirm, re-submission) are silent —
      // the body-stream tear-down surfaces as an "input stream" / AbortError, not a real failure.
      if (controller.signal.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Stream failed");
    } finally {
      // Only flip loading off if this controller is still the active one and wasn't aborted.
      if (controller === abortRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  const anyActivity = stages.some((s) => s.status !== "pending");

  const extractTrace = stages.find((s) => s.orderIdx === 1)?.trace;
  const extractParsed = extractTrace?.parsedOutput as
    | { confidence?: number; clarifying_questions?: string[] }
    | undefined;
  const clarifyingQuestions = extractParsed?.clarifying_questions ?? [];
  const extractConfidence = extractParsed?.confidence;

  return (
    <>
      {/* Top strip — just the wordmark */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center px-6 py-5">
        <span className="font-semibold tracking-tight text-[#ece8e0]">
          Pitchline
        </span>
      </header>

      <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-6 pt-[18vh] pb-24">
        {/* Hero */}
        <section className="text-center">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-[#ece8e0] md:text-5xl">
            From a one-line pitch
            <br />
            to a full campaign.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base text-[#a8a195]">
            Publishers, persona-tuned creative, and a structured campaign config — streamed back, one stage at a time.
          </p>
        </section>

        {/* Form */}
        <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-4">
          <div className="relative">
            <textarea
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              rows={4}
              placeholder="Describe your business in a sentence or two…"
              className="w-full resize-none rounded-2xl border border-[#2a2620] bg-[#16140f]/80 px-5 py-4 text-base text-[#ece8e0] placeholder:text-[#6c665d] shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur transition-colors focus:border-[#e8b97c]/50 focus:outline-none focus:ring-2 focus:ring-[#e8b97c]/20 disabled:opacity-60"
              disabled={loading}
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-[#6c665d]">try:</span>
            {EXAMPLE_PITCHES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => setPitch(ex.pitch)}
                disabled={loading}
                className="rounded-full border border-[#2a2620] bg-[#16140f]/60 px-3.5 py-1.5 text-xs text-[#a8a195] transition-all hover:border-[#3a352d] hover:bg-[#16140f] hover:text-[#ece8e0] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ex.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-4">
            <button
              type="submit"
              disabled={loading || pitch.trim().length < 3}
              className="rounded-full bg-[#e8b97c] px-7 py-3 text-sm font-medium text-[#1a1410] shadow-[0_8px_24px_rgba(232,185,124,0.18)] transition-all hover:bg-[#f0c690] hover:shadow-[0_8px_30px_rgba(232,185,124,0.28)] disabled:cursor-not-allowed disabled:bg-[#3a352d] disabled:text-[#6c665d] disabled:shadow-none"
            >
              {loading ? "Streaming…" : "Run pipeline →"}
            </button>
            {runId && (
              <span className="font-mono text-xs text-[#6c665d]">
                run · {runId.slice(0, 8)}
              </span>
            )}
          </div>
        </form>

        {/* Errors */}
        {error && (
          <div className="pl-fade-in mt-8 rounded-2xl border border-red-900/50 bg-red-950/20 px-5 py-4 text-sm text-red-300">
            <div className="font-medium">Error</div>
            <div className="mt-1 text-red-200/80">{error}</div>
          </div>
        )}

        {/* Clarifying questions banner */}
        {clarifyingQuestions.length > 0 && (
          <aside className="pl-fade-in mt-8 rounded-2xl border border-[#3a352d] bg-[#16140f]/80 px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-medium text-[#e8b97c]">Low-confidence pitch</div>
              {typeof extractConfidence === "number" && (
                <span className="font-mono text-xs text-[#a8a195]">
                  confidence · {extractConfidence.toFixed(2)}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[#a8a195]">
              The pipeline ran to completion, but the extract stage flagged the pitch as ambiguous. Answering these would improve the next run:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#ece8e0]/85">
              {clarifyingQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </aside>
        )}

        {/* Stages */}
        {anyActivity && (
          <section className="mt-8 space-y-3">
            {stages.map((s) => (
              <StageCard key={s.orderIdx} stage={s} />
            ))}
          </section>
        )}

        {/* Run summary */}
        {runMeta && (
          <footer className="pl-fade-in mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2a2620] bg-[#16140f]/60 px-5 py-3 text-xs text-[#a8a195]">
            <span>
              Total &nbsp;
              <span className="font-mono text-[#ece8e0]">
                {(runMeta.totalDurationMs / 1000).toFixed(2)}s
              </span>
              &nbsp;·&nbsp;
              <span className="font-mono text-[#ece8e0]">
                ${runMeta.totalCostUsd.toFixed(4)}
              </span>
            </span>
            <span className="font-mono text-[#6c665d]">pipeline complete</span>
          </footer>
        )}
      </main>
    </>
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
