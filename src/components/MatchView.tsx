import { publisherById } from "@/lib/data";
import type { Match } from "@/schemas";

/**
 * Per-stage renderer for stage 2 (match). The brief calls out exclusion
 * reasoning as a first-class requirement; raw JSON buries it. This pulls
 * picked + rejected into two clearly delineated lists, with publisher
 * names (not IDs) and the model's reason inline.
 */
export function MatchView({ parsedOutput }: { parsedOutput: unknown }) {
  const match = isMatch(parsedOutput) ? parsedOutput : null;
  if (!match) {
    return (
      <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed text-[#ece8e0]">
        {JSON.stringify(parsedOutput, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-[#a8a195]">
            picked · {match.picked.length}
          </h3>
          <span className="font-mono text-[10px] text-[#6c665d]">
            ordered best-fit first
          </span>
        </div>
        <div className="space-y-2">
          {match.picked.map((p) => (
            <PublisherRow
              key={`p-${p.publisher_id}`}
              id={p.publisher_id}
              reason={p.reason}
              score={p.score}
              mode="picked"
            />
          ))}
        </div>
      </section>

      {match.rejected.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer items-baseline justify-between rounded-xl border border-[#2a2620] bg-[#0e0d0c]/60 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[#a8a195] hover:bg-[#0e0d0c]">
            <span>
              considered but rejected · {match.rejected.length}
              <span className="ml-2 text-[#6c665d]">▾</span>
            </span>
            <span className="text-[#6c665d]">click to expand</span>
          </summary>
          <div className="mt-2 space-y-2">
            {match.rejected.map((r) => (
              <PublisherRow
                key={`r-${r.publisher_id}`}
                id={r.publisher_id}
                reason={r.reason}
                mode="rejected"
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function PublisherRow({
  id,
  reason,
  score,
  mode,
}: {
  id: string;
  reason: string;
  score?: number;
  mode: "picked" | "rejected";
}) {
  const publisher = publisherById.get(id);
  const name = publisher?.name ?? id;
  const isPicked = mode === "picked";
  return (
    <article
      className={[
        "rounded-xl border px-3 py-2.5 text-sm",
        isPicked
          ? "border-[#2a2620] bg-[#0e0d0c]/70"
          : "border-[#2a2620]/60 bg-[#0e0d0c]/40 opacity-90",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span
            className={`font-medium ${isPicked ? "text-[#ece8e0]" : "text-[#a8a195]"}`}
          >
            {name}
          </span>
          <span className="ml-2 font-mono text-[10px] text-[#6c665d]">{id}</span>
          {publisher?.category && (
            <span className="ml-2 font-mono text-[10px] text-[#6c665d]">
              · {publisher.category}
            </span>
          )}
        </div>
        {isPicked && typeof score === "number" && (
          <ScoreChip score={score} />
        )}
      </div>
      <p
        className={`mt-1.5 text-xs leading-relaxed ${isPicked ? "text-[#a8a195]" : "text-[#6c665d]"}`}
      >
        {reason}
      </p>
    </article>
  );
}

function ScoreChip({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const intensity =
    score >= 0.7 ? "high" : score >= 0.4 ? "mid" : "low";
  const cls =
    intensity === "high"
      ? "bg-emerald-900/30 text-emerald-300 border-emerald-800/40"
      : intensity === "mid"
        ? "bg-[#3a352d]/30 text-[#e8b97c] border-[#3a352d]"
        : "bg-[#2a2620]/40 text-[#a8a195] border-[#2a2620]";
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] ${cls}`}
    >
      {score.toFixed(2)} · {pct}%
    </span>
  );
}

function isMatch(x: unknown): x is Match {
  if (!x || typeof x !== "object") return false;
  const m = x as Partial<Match>;
  return Array.isArray(m.picked) && Array.isArray(m.rejected);
}
