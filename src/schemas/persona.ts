import { z } from "zod";

export const PriceSensitivitySchema = z.enum([
  "low",
  "low-medium",
  "medium",
  "medium-high",
  "high",
]);

export const PersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  age_range: z.string(),
  gender_skew: z.string(),
  description: z.string(),
  category_affinities: z.array(z.string()),
  price_sensitivity: PriceSensitivitySchema,
  messaging_preferences: z.array(z.string()),
  disinterested_in: z.array(z.string()),
  typical_aov_usd: z.number().positive(),
});

export type Persona = z.infer<typeof PersonaSchema>;
export type PriceSensitivity = z.infer<typeof PriceSensitivitySchema>;
