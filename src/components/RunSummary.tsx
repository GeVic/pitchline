export type RunMeta = { totalCostUsd: number; totalDurationMs: number };

export function RunSummary({ meta }: { meta: RunMeta }) {
  return (
    <footer className="pl-fade-in mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2a2620] bg-[#16140f]/60 px-5 py-3 text-xs text-[#a8a195]">
      <span>
        Total &nbsp;
        <span className="font-mono text-[#ece8e0]">
          {(meta.totalDurationMs / 1000).toFixed(2)}s
        </span>
        &nbsp;·&nbsp;
        <span className="font-mono text-[#ece8e0]">
          ${meta.totalCostUsd.toFixed(4)}
        </span>
      </span>
      <span className="font-mono text-[#6c665d]">pipeline complete</span>
    </footer>
  );
}
