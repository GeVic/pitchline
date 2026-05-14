import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatRelative(date: Date): string {
  const ms = Date.now() - date.getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default async function DebugIndex() {
  const db = getDb();
  const runs = await db
    .select({
      id: schema.runs.id,
      createdAt: schema.runs.createdAt,
      pitch: schema.runs.pitch,
      status: schema.runs.status,
      confidence: schema.runs.confidence,
      totalCostUsd: schema.runs.totalCostUsd,
      totalDurationMs: schema.runs.totalDurationMs,
    })
    .from(schema.runs)
    .orderBy(desc(schema.runs.createdAt))
    .limit(30);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-baseline justify-between border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Debug · Recent runs</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Trace surface — every pipeline run, every stage, every prompt + response saved.
          </p>
        </div>
        <Link href="/" className="font-mono text-xs text-neutral-400 hover:text-white">
          ← back to home
        </Link>
      </header>

      {runs.length === 0 ? (
        <div className="rounded-md border border-neutral-800 bg-neutral-950 p-8 text-center text-sm text-neutral-400">
          No runs yet. Submit a pitch on the home page and come back.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-neutral-800">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-neutral-900 text-left text-xs text-neutral-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">run</th>
                <th className="px-4 py-2.5 font-medium">pitch</th>
                <th className="px-4 py-2.5 font-medium">status</th>
                <th className="px-4 py-2.5 text-right font-medium">conf</th>
                <th className="px-4 py-2.5 text-right font-medium">cost</th>
                <th className="px-4 py-2.5 text-right font-medium">duration</th>
                <th className="px-4 py-2.5 text-right font-medium">when</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-neutral-800 bg-neutral-950 hover:bg-neutral-900/50"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/debug/${r.id}`}
                      className="text-blue-400 hover:underline"
                    >
                      {r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">
                    <span className="line-clamp-1">{r.pitch}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-neutral-300">
                    {r.confidence == null ? "—" : r.confidence.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-neutral-300">
                    {r.totalCostUsd == null ? "—" : `$${r.totalCostUsd.toFixed(4)}`}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-neutral-300">
                    {r.totalDurationMs == null ? "—" : `${(r.totalDurationMs / 1000).toFixed(2)}s`}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-neutral-500">
                    {formatRelative(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
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
