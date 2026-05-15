import { publisherById } from "@/lib/data";
import type { CampaignConfig } from "@/schemas";

export function CampaignConfigView({
  parsedOutput,
}: {
  parsedOutput: unknown;
}) {
  const cfg = isCampaignConfig(parsedOutput) ? parsedOutput : null;
  if (!cfg) {
    return (
      <pre className="overflow-x-auto px-4 py-3 text-xs text-[#ece8e0]">
        {JSON.stringify(parsedOutput, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-5 px-4 py-4">
      {/* Header */}
      <header>
        <div className="font-mono text-[10px] uppercase tracking-wider text-[#6c665d]">
          campaign
        </div>
        <h3 className="mt-1 text-lg font-semibold text-[#ece8e0]">
          {cfg.campaign_name}
        </h3>
      </header>

      {/* Top-level params */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="objective" value={cfg.objective} />
        <Stat label="pricing" value={cfg.pricing_model} />
        <Stat label="daily budget" value={`$${cfg.daily_budget_usd}`} />
        <Stat
          label="bid range"
          value={`$${cfg.bid_range_usd.min}–$${cfg.bid_range_usd.max} · target $${cfg.bid_range_usd.target}`}
        />
      </div>

      {/* Targeting */}
      <section>
        <SectionHeader>targeting</SectionHeader>
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="age" value={cfg.targeting.age} />
          <Field
            label="geos"
            value={cfg.targeting.geos.join(", ") || "—"}
          />
          <Field
            label="interests"
            value={
              <div className="flex flex-wrap gap-1">
                {cfg.targeting.interests.slice(0, 6).map((i) => (
                  <span
                    key={i}
                    className="rounded-full border border-[#2a2620] bg-[#0e0d0c] px-2 py-0.5 font-mono text-[10px] text-[#a8a195]"
                  >
                    {i}
                  </span>
                ))}
              </div>
            }
          />
        </div>
      </section>

      {/* Placements with budget-share bars */}
      <section>
        <SectionHeader>
          placements · {cfg.placements.length} · sum {Math.round(
            cfg.placements.reduce((s, p) => s + p.budget_share, 0) * 100,
          )}%
        </SectionHeader>
        <div className="mt-2 space-y-1.5">
          {[...cfg.placements]
            .sort((a, b) => b.budget_share - a.budget_share)
            .map((p) => {
              const name =
                publisherById.get(p.publisher_id)?.name ?? p.publisher_id;
              const pct = Math.round(p.budget_share * 100);
              return (
                <div
                  key={p.publisher_id}
                  className="rounded-xl border border-[#2a2620] bg-[#0e0d0c]/60 px-3 py-2"
                >
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-[#ece8e0]">
                      {name}{" "}
                      <span className="ml-1 font-mono text-[10px] text-[#6c665d]">
                        {p.publisher_id}
                      </span>
                    </span>
                    <span className="font-mono text-xs text-[#e8b97c]">
                      {pct}% · ${(cfg.daily_budget_usd * p.budget_share).toFixed(2)}/day
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#2a2620]">
                    <div
                      className="h-full rounded-full bg-[#e8b97c]/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-[#6c665d]">
                    creatives · {p.creative_ids.join(", ")}
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* Raw JSON behind a toggle, for those who want it */}
      <details>
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-[#6c665d] hover:text-[#a8a195]">
          raw JSON
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-[#0e0d0c]/60 p-3 text-[11px] leading-relaxed text-[#a8a195]">
          {JSON.stringify(cfg, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#2a2620] bg-[#0e0d0c]/60 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-[#6c665d]">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm text-[#ece8e0]">{value}</div>
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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wider text-[#a8a195]">
      {children}
    </div>
  );
}

function isCampaignConfig(x: unknown): x is CampaignConfig {
  if (!x || typeof x !== "object") return false;
  const c = x as Partial<CampaignConfig>;
  return (
    typeof c.campaign_name === "string" &&
    typeof c.objective === "string" &&
    Array.isArray(c.placements) &&
    Array.isArray(c.creatives)
  );
}
