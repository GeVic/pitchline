import {
  CampaignConfigSchema,
  type CampaignConfig,
  type Extract,
  type Match,
  type PersonasPicked,
  type Creatives,
  type Objective,
  type PricingModel,
} from "@/schemas";
import { personaById, publisherById } from "@/lib/data";
import type { CallResult } from "@/lib/claude";

export type ConfigInputs = {
  extract: Extract;
  match: Match;
  personasPicked: PersonasPicked;
  creatives: Creatives;
};

const BUDGET_BY_TIER: Record<Extract["price_tier"], number> = {
  budget: 50,
  mid: 80,
  premium: 120,
  luxury: 200,
};

function parseAgeRange(s: string): [number, number] | null {
  const m = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!m || !m[1] || !m[2]) return null;
  const lo = Number.parseInt(m[1], 10);
  const hi = Number.parseInt(m[2], 10);
  return Number.isFinite(lo) && Number.isFinite(hi) ? [lo, hi] : null;
}

function buildCampaignName(extract: Extract): string {
  const slug = (extract.category.split("·")[0] ?? "campaign")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "campaign";
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-${date}`;
}

function pickObjective(extract: Extract): Objective {
  if (extract.business_model === "subscription") return "subscriptions";
  if (extract.business_model === "b2b") return "conversions";
  if (extract.confidence < 0.4) return "awareness";
  return "conversions";
}

function pickPricingModel(objective: Objective): PricingModel {
  if (objective === "awareness") return "CPM";
  if (objective === "traffic") return "CPC";
  return "CPA";
}

function buildBidRange(pricingModel: PricingModel, dailyBudget: number) {
  if (pricingModel === "CPM") {
    return { min: 4, target: 8, max: 14 };
  }
  if (pricingModel === "CPC") {
    return { min: 0.5, target: 1.5, max: 3.5 };
  }
  return {
    min: Math.max(2, Math.round(dailyBudget / 10)),
    target: Math.max(4, Math.round(dailyBudget / 5)),
    max: Math.max(8, Math.round(dailyBudget / 3)),
  };
}

export function buildConfig(inputs: ConfigInputs): CampaignConfig {
  const { extract, match, personasPicked, creatives } = inputs;

  const picksWithPositiveScore = match.picked.filter((p) => p.score > 0);
  const placementsSource = picksWithPositiveScore.length > 0
    ? picksWithPositiveScore
    : match.picked;
  if (placementsSource.length === 0) {
    throw new Error("Stage 5: no publishers picked in stage 2, cannot build placements.");
  }

  const pickedPersonas = personasPicked.picked.flatMap((p) => {
    const r = personaById.get(p.persona_id);
    return r ? [r] : [];
  });
  const ageRanges = pickedPersonas
    .flatMap((p) => {
      const parsed = parseAgeRange(p.age_range);
      return parsed ? [parsed] : [];
    });
  const ageLo = ageRanges.length > 0
    ? Math.min(...ageRanges.map(([lo]) => lo))
    : 25;
  const ageHi = ageRanges.length > 0
    ? Math.max(...ageRanges.map(([, hi]) => hi))
    : 54;

  const interests = Array.from(
    new Set([
      ...extract.signals,
      ...extract.audience_hints,
      ...pickedPersonas.flatMap((p) => p.category_affinities),
    ]),
  ).slice(0, 10);

  const geos = Array.from(
    new Set(
      placementsSource.flatMap((p) => {
        const pub = publisherById.get(p.publisher_id);
        return pub?.audience.top_geos ?? [];
      }),
    ),
  );

  const totalScore = placementsSource.reduce((s, p) => s + p.score, 0);
  const totalScoreSafe = totalScore > 0 ? totalScore : placementsSource.length;
  const creativeIds = creatives.creatives.map((c) => c.id);

  const placements = placementsSource.map((p) => ({
    publisher_id: p.publisher_id,
    budget_share: (p.score > 0 ? p.score : 1) / totalScoreSafe,
    creative_ids: creativeIds,
  }));

  const runningSum = placements.reduce((s, p) => s + p.budget_share, 0);
  const lastIdx = placements.length - 1;
  const last = placements[lastIdx];
  if (last) {
    placements[lastIdx] = {
      ...last,
      budget_share: last.budget_share + (1.0 - runningSum),
    };
  }

  const objective = pickObjective(extract);
  const pricing_model = pickPricingModel(objective);
  const daily_budget_usd = BUDGET_BY_TIER[extract.price_tier];

  const config: CampaignConfig = CampaignConfigSchema.parse({
    campaign_name: buildCampaignName(extract),
    objective,
    daily_budget_usd,
    pricing_model,
    bid_range_usd: buildBidRange(pricing_model, daily_budget_usd),
    targeting: {
      age: `${ageLo}-${ageHi}`,
      interests,
      geos,
    },
    placements,
    creatives: creatives.creatives.map((c) => ({
      id: c.id,
      persona_id: c.persona_id,
      headline: c.headline,
      body: c.body,
      cta: c.cta,
    })),
    confidence: extract.confidence,
    clarifying_questions: extract.clarifying_questions,
  });

  return config;
}

export async function runConfig(inputs: ConfigInputs): Promise<CallResult<CampaignConfig>> {
  const started = Date.now();
  const parsed = buildConfig(inputs);
  const durationMs = Date.now() - started;
  const raw = JSON.stringify(parsed, null, 2);
  return {
    parsed,
    raw,
    prompt: [
      "[deterministic assembly — no LLM call]",
      "Inputs:",
      JSON.stringify(
        {
          extract: inputs.extract,
          match: inputs.match,
          personasPicked: inputs.personasPicked,
          creatives: inputs.creatives,
        },
        null,
        2,
      ),
    ].join("\n"),
    model: "code",
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    durationMs,
    attempts: 1,
  };
}
