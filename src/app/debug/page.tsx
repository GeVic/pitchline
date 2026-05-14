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
    <>
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="font-semibold tracking-tight text-[#ece8e0] hover:text-white"
        >
          Pitchline
        </Link>
        <Link
          href="/"
          className="font-mono text-xs text-[#a8a195] transition-colors hover:text-white"
        >
          ← home
        </Link>
      </header>

      <main className="relative mx-auto max-w-5xl px-6 pt-[14vh] pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-[#ece8e0]">
            Debug · Recent runs
          </h1>
          <p className="mt-2 text-sm text-[#a8a195]">
            Trace surface — every pipeline run, every stage, every prompt + response saved.
          </p>
        </div>

        {runs.length === 0 ? (
          <div className="rounded-2xl border border-[#2a2620] bg-[#16140f]/60 p-10 text-center text-sm text-[#a8a195]">
            No runs yet. Submit a pitch on the home page and come back.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#2a2620] bg-[#16140f]/60 backdrop-blur">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#0e0d0c]/60 text-left text-xs text-[#a8a195]">
                <tr>
                  <th className="px-4 py-3 font-medium">run</th>
                  <th className="px-4 py-3 font-medium">pitch</th>
                  <th className="px-4 py-3 font-medium">status</th>
                  <th className="px-4 py-3 text-right font-medium">conf</th>
                  <th className="px-4 py-3 text-right font-medium">cost</th>
                  <th className="px-4 py-3 text-right font-medium">duration</th>
                  <th className="px-4 py-3 text-right font-medium">when</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-[#2a2620] transition-colors hover:bg-[#1c1913]/60"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/debug/${r.id}`}
                        className="text-[#e8b97c] hover:underline"
                      >
                        {r.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#ece8e0]">
                      <span className="line-clamp-1">{r.pitch}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-[#ece8e0]">
                      {r.confidence == null ? "—" : r.confidence.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-[#ece8e0]">
                      {r.totalCostUsd == null
                        ? "—"
                        : `$${r.totalCostUsd.toFixed(4)}`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-[#ece8e0]">
                      {r.totalDurationMs == null
                        ? "—"
                        : `${(r.totalDurationMs / 1000).toFixed(2)}s`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-[#6c665d]">
                      {formatRelative(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
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
