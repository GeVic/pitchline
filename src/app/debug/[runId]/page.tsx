import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: Promise<{ runId: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RunDetail({ params }: PageProps) {
  const { runId } = await params;
  if (!UUID_RE.test(runId)) notFound();

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.id, runId))
    .limit(1);
  const run = rows[0];
  if (!run) notFound();

  const stages = await db
    .select()
    .from(schema.stages)
    .where(eq(schema.stages.runId, runId))
    .orderBy(asc(schema.stages.orderIdx));

  const extractStage = stages.find((s) => s.stageName === "extract");
  const extractParsed = extractStage?.parsedOutput as
    | { confidence?: number; clarifying_questions?: string[] }
    | null
    | undefined;
  const clarifyingQuestions = extractParsed?.clarifying_questions ?? [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 border-b border-neutral-800 pb-5">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Run · <span className="font-mono text-neutral-400">{run.id.slice(0, 8)}</span>
            </h1>
            <p className="mt-1 text-xs text-neutral-500">{run.id}</p>
          </div>
          <Link
            href="/debug"
            className="font-mono text-xs text-neutral-400 hover:text-white"
          >
            ← all runs
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <KV label="status" value={<StatusBadge status={run.status} />} />
          <KV label="confidence" value={run.confidence == null ? "—" : run.confidence.toFixed(2)} />
          <KV label="cost" value={run.totalCostUsd == null ? "—" : `$${run.totalCostUsd.toFixed(4)}`} />
          <KV
            label="duration"
            value={run.totalDurationMs == null ? "—" : `${(run.totalDurationMs / 1000).toFixed(2)}s`}
          />
          <KV label="stages" value={`${stages.length}/5`} />
          <KV label="created" value={run.createdAt.toISOString().replace("T", " ").slice(0, 19)} />
        </div>
        <details className="mt-5 rounded border border-neutral-800 bg-neutral-950 p-3 text-sm">
          <summary className="cursor-pointer text-neutral-400">
            <span className="font-mono text-xs text-neutral-500">pitch:</span>{" "}
            <span className="text-neutral-200">{run.pitch}</span>
          </summary>
        </details>
        {run.errorMessage && (
          <div className="mt-4 rounded border border-red-900/60 bg-red-950/30 px-3 py-2 font-mono text-xs text-red-300">
            <span className="font-semibold">error:</span>{" "}
            <span className="whitespace-pre-wrap">{run.errorMessage}</span>
          </div>
        )}
      </header>

      {clarifyingQuestions.length > 0 && (
        <aside className="mb-6 rounded-md border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-sm">
          <div className="font-medium text-amber-300">
            Pitch flagged as ambiguous — {clarifyingQuestions.length} clarifying question{clarifyingQuestions.length === 1 ? "" : "s"}
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100/85">
            {clarifyingQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </aside>
      )}

      <section className="space-y-4">
        {stages.map((s) => (
          <StageBlock key={s.id} stage={s} />
        ))}
        {stages.length === 0 && (
          <div className="rounded-md border border-neutral-800 bg-neutral-950 p-6 text-center text-sm text-neutral-400">
            No stages recorded for this run.
          </div>
        )}
      </section>

      {run.finalConfig != null && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Final campaign config
          </h2>
          <pre className="overflow-x-auto rounded-md border border-neutral-800 bg-neutral-950 p-4 text-xs leading-relaxed text-neutral-200">
            {JSON.stringify(run.finalConfig, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}

function StageBlock({ stage }: { stage: typeof schema.stages.$inferSelect }) {
  return (
    <article className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2.5">
          <StatusDot status={stage.status} />
          <span className="font-mono text-neutral-300">
            stage 0{stage.orderIdx} · {stage.stageName}
          </span>
          {stage.model && (
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
              {stage.model}
            </span>
          )}
        </div>
        <div className="font-mono text-[11px] text-neutral-500">
          {stage.durationMs != null && <>{stage.durationMs} ms · </>}
          {stage.tokensIn != null && stage.tokensOut != null && (
            <>
              {stage.tokensIn}↓ {stage.tokensOut}↑ ·{" "}
            </>
          )}
          {stage.costUsd != null && <>${stage.costUsd.toFixed(6)}</>}
        </div>
      </header>

      {stage.errorMessage && (
        <div className="border-b border-red-900/40 bg-red-950/20 px-4 py-2.5 font-mono text-xs text-red-300">
          <span className="font-semibold">error:</span>{" "}
          <span className="whitespace-pre-wrap">{stage.errorMessage}</span>
        </div>
      )}

      {stage.parsedOutput != null && (
        <details className="border-b border-neutral-800" open>
          <summary className="cursor-pointer bg-neutral-900/50 px-4 py-2 font-mono text-xs text-neutral-400 hover:text-neutral-200">
            parsed output (validated)
          </summary>
          <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed text-neutral-200">
            {JSON.stringify(stage.parsedOutput, null, 2)}
          </pre>
        </details>
      )}

      {stage.rawResponse && (
        <details className="border-b border-neutral-800">
          <summary className="cursor-pointer bg-neutral-900/50 px-4 py-2 font-mono text-xs text-neutral-400 hover:text-neutral-200">
            raw model response
          </summary>
          <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed text-neutral-300">
            {stage.rawResponse}
          </pre>
        </details>
      )}

      {stage.prompt && (
        <details>
          <summary className="cursor-pointer bg-neutral-900/50 px-4 py-2 font-mono text-xs text-neutral-400 hover:text-neutral-200">
            full prompt (system + user)
          </summary>
          <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3 text-xs leading-relaxed text-neutral-300">
            {stage.prompt}
          </pre>
        </details>
      )}
    </article>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="font-mono text-neutral-300">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "bg-emerald-900/40 text-emerald-300"
      : status === "failed"
        ? "bg-red-900/40 text-red-300"
        : status === "running"
          ? "bg-amber-900/40 text-amber-300"
          : "bg-neutral-800 text-neutral-400";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${cls}`}
    >
      {status}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
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
