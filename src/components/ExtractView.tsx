import type { Extract } from "@/schemas";

export function ExtractView({ parsedOutput }: { parsedOutput: unknown }) {
  const x = isExtract(parsedOutput) ? parsedOutput : null;
  if (!x) {
    return (
      <pre className="overflow-x-auto px-4 py-3 text-xs text-[#ece8e0]">
        {JSON.stringify(parsedOutput, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {/* Header row: category + price + business model */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="category" value={x.category} />
        <Field
          label="price tier"
          value={<PriceTierChip tier={x.price_tier} />}
        />
        <Field
          label="business model"
          value={x.business_model ?? <Muted>—</Muted>}
        />
      </div>

      {/* Signal groups */}
      <ChipGroup label="positive signals" items={x.signals} tone="positive" />
      <ChipGroup
        label="audience hints"
        items={x.audience_hints}
        tone="neutral"
      />
      <ChipGroup label="avoid" items={x.excludes} tone="negative" />
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#2a2620] bg-[#0e0d0c]/60 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-[#6c665d]">
        {label}
      </div>
      <div className="mt-1 text-sm text-[#ece8e0]">{value}</div>
    </div>
  );
}

function ChipGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "positive" | "neutral" | "negative";
}) {
  if (items.length === 0) {
    return (
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-[#6c665d]">
          {label}
        </div>
        <div className="mt-1 text-xs italic text-[#6c665d]">none</div>
      </div>
    );
  }
  const chipCls =
    tone === "positive"
      ? "border-emerald-800/50 bg-emerald-900/20 text-emerald-300"
      : tone === "negative"
        ? "border-red-900/40 bg-red-950/15 text-red-300/85"
        : "border-[#2a2620] bg-[#0e0d0c]/60 text-[#ece8e0]";
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-[#6c665d]">
        {label}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${chipCls}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function PriceTierChip({ tier }: { tier: Extract["price_tier"] }) {
  const cls = {
    budget: "border-[#2a2620] bg-[#0e0d0c] text-[#a8a195]",
    mid: "border-[#3a352d] bg-[#16140f] text-[#ece8e0]",
    premium: "border-[#3a352d] bg-[#3a352d]/40 text-[#e8b97c]",
    luxury: "border-[#3a352d] bg-[#3a352d]/60 text-[#f0c690]",
  }[tier];
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide ${cls}`}
    >
      {tier}
    </span>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-[#6c665d]">{children}</span>;
}

function isExtract(x: unknown): x is Extract {
  if (!x || typeof x !== "object") return false;
  const e = x as Partial<Extract>;
  return (
    typeof e.category === "string" &&
    typeof e.price_tier === "string" &&
    Array.isArray(e.signals) &&
    Array.isArray(e.audience_hints) &&
    Array.isArray(e.excludes)
  );
}
