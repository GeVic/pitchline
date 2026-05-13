import { z } from "zod";

export const PriceTierSchema = z.enum(["budget", "mid", "premium", "luxury"]);

/**
 * Stage 1 output. Structured signals derived from the advertiser pitch.
 */
export const ExtractSchema = z.object({
  category: z.string().describe("Primary category, e.g. 'pet · pet_food'"),
  price_tier: PriceTierSchema,
  business_model: z.string().nullable().describe("'subscription', 'one-time', 'b2b', etc."),
  audience_hints: z.array(z.string()).describe("Free-text hints, e.g. 'dog owners 35-60'"),
  signals: z.array(z.string()).describe("Positive signals: things to lean into"),
  excludes: z.array(z.string()).describe("Negative signals: positioning to avoid"),
  confidence: z.number().min(0).max(1),
  clarifying_questions: z.array(z.string()).describe("Empty when confident; populated for vague input"),
});

export type Extract = z.infer<typeof ExtractSchema>;
export type PriceTier = z.infer<typeof PriceTierSchema>;
