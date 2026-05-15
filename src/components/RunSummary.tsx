export type RunMeta = { totalCostUsd: number; totalDurationMs: number };

export function RunSummary({ meta }: { meta: RunMeta }) {
  return (
    <footer className="pl-fade-in mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2a2620] bg-[#16140f]/60 px-5 py-3 text-xs text-[#a8a195]">
      <span>
        Took{" "}
        <span className="font-mono text-[#ece8e0]">
          {formatTotal(meta.totalDurationMs)}
        </span>
      </span>
      <span className="font-mono text-[#6c665d]">campaign ready</span>
    </footer>
  );
}

function formatTotal(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}
