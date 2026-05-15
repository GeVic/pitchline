import { personaById } from "@/lib/data";
import type { Creatives } from "@/schemas";

export function CreativeView({ parsedOutput }: { parsedOutput: unknown }) {
  const c = isCreatives(parsedOutput) ? parsedOutput : null;
  if (!c) {
    return (
      <pre className="overflow-x-auto px-4 py-3 text-xs text-[#ece8e0]">
        {JSON.stringify(parsedOutput, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-[#a8a195]">
        creatives · {c.creatives.length}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {c.creatives.map((cr) => (
          <AdCard key={cr.id} creative={cr} />
        ))}
      </div>
    </div>
  );
}

function AdCard({
  creative,
}: {
  creative: Creatives["creatives"][number];
}) {
  const persona = personaById.get(creative.persona_id);
  const personaName = persona?.name ?? creative.persona_id;
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-[#2a2620] bg-gradient-to-br from-[#1c1913]/80 to-[#16140f]/60 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2 text-[10px]">
        <span className="font-mono uppercase tracking-wider text-[#6c665d]">
          for · {personaName}
        </span>
        <span className="font-mono text-[#6c665d]">{creative.id}</span>
      </header>

      <div className="space-y-2">
        <h3 className="text-balance text-base font-semibold leading-snug text-[#ece8e0]">
          {creative.headline}
        </h3>
        <p className="text-sm leading-relaxed text-[#a8a195]">{creative.body}</p>
      </div>

      <div>
        <button
          type="button"
          disabled
          className="inline-flex cursor-default items-center gap-1.5 rounded-full bg-[#e8b97c] px-3.5 py-1.5 text-xs font-medium text-[#1a1410] opacity-90"
        >
          {creative.cta}
          <span aria-hidden>→</span>
        </button>
      </div>

      <footer className="mt-1 space-y-1 border-t border-[#2a2620] pt-2 text-[10px]">
        <div className="font-mono text-[#6c665d]">
          voice · <span className="text-[#a8a195]">{creative.voice}</span>
        </div>
        <div className="leading-snug text-[#6c665d]">
          <span className="font-mono uppercase tracking-wider">why ·</span>{" "}
          {creative.why_this_persona}
        </div>
      </footer>
    </article>
  );
}

function isCreatives(x: unknown): x is Creatives {
  if (!x || typeof x !== "object") return false;
  const c = x as Partial<Creatives>;
  return Array.isArray(c.creatives);
}
