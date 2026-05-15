import { personaById } from "@/lib/data";
import type { PersonasPicked, PersonaPickTag } from "@/schemas";

export function PersonasView({ parsedOutput }: { parsedOutput: unknown }) {
  const picks = isPersonasPicked(parsedOutput) ? parsedOutput : null;
  if (!picks) {
    return (
      <pre className="overflow-x-auto px-4 py-3 text-xs text-[#ece8e0]">
        {JSON.stringify(parsedOutput, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-2 px-4 py-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-[#a8a195]">
        picked · {picks.picked.length}
      </div>
      <div className="space-y-2">
        {picks.picked.map((p) => (
          <PersonaRow
            key={p.persona_id}
            id={p.persona_id}
            tag={p.tag}
            why={p.why}
          />
        ))}
      </div>
    </div>
  );
}

function PersonaRow({
  id,
  tag,
  why,
}: {
  id: string;
  tag: PersonaPickTag;
  why: string;
}) {
  const persona = personaById.get(id);
  const name = persona?.name ?? id;
  return (
    <article className="rounded-xl border border-[#2a2620] bg-[#0e0d0c]/70 px-3 py-2.5">
      <header className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium text-[#ece8e0]">{name}</span>
        <span className="font-mono text-[10px] text-[#6c665d]">{id}</span>
        <TagChip tag={tag} />
        {persona && (
          <span className="font-mono text-[10px] text-[#6c665d]">
            · {persona.age_range} · {persona.gender_skew}
          </span>
        )}
      </header>
      <p className="mt-1.5 text-xs leading-relaxed text-[#a8a195]">{why}</p>
    </article>
  );
}

function TagChip({ tag }: { tag: PersonaPickTag }) {
  const cls = {
    obvious:
      "border-emerald-800/50 bg-emerald-900/20 text-emerald-300",
    adjacent: "border-[#3a352d] bg-[#3a352d]/30 text-[#e8b97c]",
    "non-obvious":
      "border-purple-800/50 bg-purple-950/20 text-purple-300",
  }[tag];
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${cls}`}
    >
      {tag}
    </span>
  );
}

function isPersonasPicked(x: unknown): x is PersonasPicked {
  if (!x || typeof x !== "object") return false;
  const p = x as Partial<PersonasPicked>;
  return Array.isArray(p.picked);
}
