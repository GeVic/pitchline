import { z } from "zod";

export const ObjectiveSchema = z.enum([
  "subscriptions",
  "conversions",
  "awareness",
  "traffic",
  "sales",
]);

export const PricingModelSchema = z.enum(["CPM", "CPC", "CPA"]);

export const BidRangeSchema = z
  .object({
    min: z.number().positive(),
    target: z.number().positive(),
    max: z.number().positive(),
  })
  .refine((r) => r.min <= r.target && r.target <= r.max, {
    message: "bid_range must satisfy min ≤ target ≤ max",
  });

export const TargetingSchema = z.object({
  age: z.string(),
  interests: z.array(z.string()),
  geos: z.array(z.string()),
});

export const PlacementSchema = z.object({
  publisher_id: z.string(),
  budget_share: z.number().min(0).max(1),
  creative_ids: z.array(z.string()).min(1),
  test: z.boolean().optional(),
});

export const CampaignCreativeSchema = z.object({
  id: z.string(),
  persona_id: z.string(),
  headline: z.string(),
  body: z.string(),
  cta: z.string(),
});

/**
 * Final pipeline output. The nested per-publisher shape from the planning doc.
 * Includes the budget-share-sums-to-1 invariant as a refinement — caught at the schema, not downstream.
 */
export const CampaignConfigSchema = z
  .object({
    campaign_name: z.string(),
    objective: ObjectiveSchema,
    daily_budget_usd: z.number().positive(),
    pricing_model: PricingModelSchema,
    bid_range_usd: BidRangeSchema,
    targeting: TargetingSchema,
    placements: z.array(PlacementSchema).min(1),
    creatives: z.array(CampaignCreativeSchema).min(1),
    confidence: z.number().min(0).max(1),
    clarifying_questions: z.array(z.string()),
  })
  .refine(
    (cfg) => {
      const total = cfg.placements.reduce((sum, p) => sum + p.budget_share, 0);
      return Math.abs(total - 1.0) < 0.001;
    },
    { message: "placements.budget_share must sum to 1.0 (±0.001)" },
  );

export type Objective = z.infer<typeof ObjectiveSchema>;
export type PricingModel = z.infer<typeof PricingModelSchema>;
export type BidRange = z.infer<typeof BidRangeSchema>;
export type Targeting = z.infer<typeof TargetingSchema>;
export type Placement = z.infer<typeof PlacementSchema>;
export type CampaignCreative = z.infer<typeof CampaignCreativeSchema>;
export type CampaignConfig = z.infer<typeof CampaignConfigSchema>;
