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
    <>
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="font-semibold tracking-tight text-[#ece8e0] hover:text-white"
        >
          Pitchline
        </Link>
        <Link
          href="/debug"
          className="font-mono text-xs text-[#a8a195] transition-colors hover:text-white"
        >
          ← all runs
        </Link>
      </header>

      <main className="relative mx-auto max-w-5xl px-6 pt-[14vh] pb-24">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[#ece8e0]">
            Run · <span className="font-mono text-[#a8a195]">{run.id.slice(0, 8)}</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-[#6c665d]">{run.id}</p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <KV label="status" value={<StatusBadge status={run.status} />} />
          <KV
            label="confidence"
            value={run.confidence == null ? "—" : run.confidence.toFixed(2)}
          />
          <KV
            label="cost"
            value={run.totalCostUsd == null ? "—" : `$${run.totalCostUsd.toFixed(4)}`}
          />
          <KV
            label="duration"
            value={
              run.totalDurationMs == null
                ? "—"
                : `${(run.totalDurationMs / 1000).toFixed(2)}s`
            }
          />
          <KV label="stages" value={`${stages.length}/5`} />
          <KV
            label="created"
            value={run.createdAt.toISOString().replace("T", " ").slice(0, 19)}
          />
        </div>

        <section className="mb-6 rounded-2xl border border-[#2a2620] bg-[#16140f]/60 px-4 py-3 backdrop-blur">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[#6c665d]">
            pitch
          </div>
          <p className="mt-1 text-sm leading-relaxed text-[#ece8e0]">{run.pitch}</p>
        </section>

        {run.errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-900/50 bg-red-950/20 px-4 py-3 font-mono text-xs text-red-300">
            <span className="font-semibold">error:</span>{" "}
            <span className="whitespace-pre-wrap">{run.errorMessage}</span>
          </div>
        )}

        {clarifyingQuestions.length > 0 && (
          <aside className="mb-6 rounded-2xl border border-[#3a352d] bg-[#16140f]/80 px-5 py-4">
            <div className="font-medium text-[#e8b97c]">
              Pitch flagged as ambiguous — {clarifyingQuestions.length}{" "}
              clarifying question{clarifyingQuestions.length === 1 ? "" : "s"}
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#ece8e0]/85">
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
            <div className="rounded-2xl border border-[#2a2620] bg-[#16140f]/60 p-8 text-center text-sm text-[#a8a195]">
              No stages recorded for this run.
            </div>
          )}
        </section>

        {run.finalConfig != null && (
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#a8a195]">
              Final campaign config
            </h2>
            <pre className="overflow-x-auto rounded-2xl border border-[#2a2620] bg-[#16140f]/70 p-5 text-xs leading-relaxed text-[#ece8e0] backdrop-blur">
              {JSON.stringify(run.finalConfig, null, 2)}
            </pre>
          </section>
        )}
      </main>
    </>
  );
}

function StageBlock({ stage }: { stage: typeof schema.stages.$inferSelect }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#2a2620] bg-[#16140f]/70 backdrop-blur">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2a2620] bg-[#0e0d0c]/50 px-4 py-3 text-xs">
        <div className="flex items-center gap-2.5">
          <StatusDot status={stage.status} />
          <span className="font-mono text-[#ece8e0]">
            stage 0{stage.orderIdx} · {stage.stageName}
          </span>
          {stage.model && (
            <span className="rounded-full border border-[#2a2620] bg-[#0e0d0c] px-2 py-0.5 font-mono text-[10px] text-[#a8a195]">
              {stage.model}
            </span>
          )}
        </div>
        <div className="font-mono text-[11px] text-[#6c665d]">
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
        <details className="border-b border-[#2a2620]" open>
          <summary className="cursor-pointer bg-[#0e0d0c]/40 px-4 py-2 font-mono text-xs text-[#a8a195] hover:text-[#ece8e0]">
            parsed output (validated)
          </summary>
          <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed text-[#ece8e0]">
            {JSON.stringify(stage.parsedOutput, null, 2)}
          </pre>
        </details>
      )}

      {stage.rawResponse && (
        <details className="border-b border-[#2a2620]">
          <summary className="cursor-pointer bg-[#0e0d0c]/40 px-4 py-2 font-mono text-xs text-[#a8a195] hover:text-[#ece8e0]">
            raw model response
          </summary>
          <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed text-[#ece8e0]/85">
            {stage.rawResponse}
          </pre>
        </details>
      )}

      {stage.prompt && (
        <details>
          <summary className="cursor-pointer bg-[#0e0d0c]/40 px-4 py-2 font-mono text-xs text-[#a8a195] hover:text-[#ece8e0]">
            full prompt (system + user)
          </summary>
          <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3 text-xs leading-relaxed text-[#ece8e0]/85">
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
      <span className="font-mono text-[10px] uppercase tracking-wide text-[#6c665d]">
        {label}
      </span>
      <span className="font-mono text-[#ece8e0]">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "border border-emerald-800/50 bg-emerald-900/20 text-emerald-300"
      : status === "failed"
        ? "border border-red-800/50 bg-red-900/20 text-red-300"
        : status === "running"
          ? "border border-[#3a352d] bg-[#3a352d]/30 text-[#e8b97c]"
          : "border border-[#2a2620] bg-[#16140f] text-[#a8a195]";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${cls}`}
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
        ? "bg-[#e8b97c] animate-pulse"
        : status === "failed"
          ? "bg-red-400"
          : "bg-[#3a352d]";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}
