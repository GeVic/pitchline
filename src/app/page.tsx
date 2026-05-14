"use client";

import { useState } from "react";

type ApiResult = {
  runId: string;
  pitch: string;
  status: "completed" | "failed";
  stages: Array<{
    name: string;
    orderIdx: number;
    status: string;
    parsedOutput: unknown;
    model: string;
    tokensIn: number;
    tokensOut: number;
    durationMs: number;
    costUsd: number;
  }>;
  totalCostUsd: number;
  totalDurationMs: number;
  errorMessage?: string;
};

export default function Home() {
  const [pitch, setPitch] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pitch }),
      });
      const json = await r.json();
      if (!r.ok) {
        setError(json.error ?? `HTTP ${r.status}`);
      } else {
        setResult(json as ApiResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Disco</h1>
      <p className="mt-3 text-sm text-neutral-400">
        Paste a one-sentence advertiser pitch. Stage 1 (extract) runs against Claude Haiku 4.5 and persists a trace row.
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
            {loading ? "Running…" : "Run pipeline"}
          </button>
          {loading && (
            <span className="text-xs text-neutral-500">Stage 1 in flight…</span>
          )}
        </div>
      </form>

      {error && (
        <div className="mt-6 rounded-md border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          <div className="font-medium">Error</div>
          <div className="mt-1 text-red-200/80">{error}</div>
        </div>
      )}

      {result && (
        <section className="mt-8 space-y-4">
          <header className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
            <span className="font-mono">run · {result.runId.slice(0, 8)}</span>
            <span>·</span>
            <span>status · <span className={result.status === "completed" ? "text-emerald-400" : "text-red-400"}>{result.status}</span></span>
            <span>·</span>
            <span>{result.totalDurationMs} ms</span>
            <span>·</span>
            <span>${result.totalCostUsd.toFixed(6)}</span>
          </header>

          {result.stages.map((s) => (
            <article
              key={s.orderIdx}
              className="rounded-md border border-neutral-800 bg-neutral-950"
            >
              <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-2 text-xs text-neutral-400">
                <div className="flex items-center gap-3">
                  <span className="font-mono">stage 0{s.orderIdx} · {s.name}</span>
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px]">{s.model}</span>
                </div>
                <div className="font-mono text-[11px]">
                  {s.durationMs} ms · {s.tokensIn}↓ {s.tokensOut}↑ · ${s.costUsd.toFixed(6)}
                </div>
              </header>
              <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed text-neutral-200">
                {JSON.stringify(s.parsedOutput, null, 2)}
              </pre>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
