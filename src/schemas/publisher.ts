import { z } from "zod";

export const IncomeTierSchema = z.enum(["low", "mid", "mid-high", "high"]);

export const PublisherSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  subcategories: z.array(z.string()),
  monthly_impressions: z.number().int().positive(),
  avg_order_value_usd: z.number().positive(),
  audience: z.object({
    age_skew: z.string(),
    gender_split: z.object({
      female: z.number().min(0).max(1),
      male: z.number().min(0).max(1),
      other: z.number().min(0).max(1).optional(),
    }),
    top_geos: z.array(z.string()),
    income_tier: IncomeTierSchema,
  }),
  notes: z.string(),
});

export type Publisher = z.infer<typeof PublisherSchema>;
export type IncomeTier = z.infer<typeof IncomeTierSchema>;
