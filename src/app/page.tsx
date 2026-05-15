"use client";

import { useEffect, useRef, useState } from "react";
import { PitchForm } from "@/components/PitchForm";
import {
  StageList,
  cloneInitialStages,
  type StageState,
} from "@/components/StageList";
import { ClarifyingBanner } from "@/components/ClarifyingBanner";
import { ErrorBanner } from "@/components/ErrorBanner";
import { RunSummary, type RunMeta } from "@/components/RunSummary";
import { parseSseStream } from "@/lib/sse";

export default function Home() {
  const [pitch, setPitch] = useState("");
  const [stages, setStages] = useState<StageState[]>(cloneInitialStages());
  const [runMeta, setRunMeta] = useState<RunMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  function patchStage(orderIdx: number, patch: Partial<StageState>) {
    setStages((prev) =>
      prev.map((s) => (s.orderIdx === orderIdx ? { ...s, ...patch } : s)),
    );
  }

  // Cancel any in-flight stream when the page unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Browser-level guard for back / refresh / tab-close while loading.
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

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setRunMeta(null);
    setStages(cloneInitialStages());

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
            // runId is intentionally not surfaced in the customer UI;
            // /debug uses the persisted runs.id directly.
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
                  typeof d.errorMessage === "string"
                    ? d.errorMessage
                    : "Stage failed",
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
      if (controller.signal.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Stream failed");
    } finally {
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
      <header className="absolute inset-x-0 top-0 z-10 flex items-center px-6 py-5">
        <span className="font-semibold tracking-tight text-[#ece8e0]">
          Pitchline
        </span>
      </header>

      <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-6 pt-[18vh] pb-24">
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

        <PitchForm
          pitch={pitch}
          onPitchChange={setPitch}
          loading={loading}
          onSubmit={onSubmit}
        />

        {error && <ErrorBanner message={error} />}

        <ClarifyingBanner
          questions={clarifyingQuestions}
          confidence={extractConfidence}
        />

        {anyActivity && <StageList stages={stages} />}

        {runMeta && <RunSummary meta={runMeta} />}
      </main>
    </>
  );
}
