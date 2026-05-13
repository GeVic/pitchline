import { z } from "zod";

export const CreativeSchema = z.object({
  id: z.string().describe("Stable identifier, e.g. 'cr_pet_parent'"),
  persona_id: z.string(),
  voice: z.string().describe("One-line voice description, e.g. 'warm, ingredient-honest'"),
  headline: z.string().min(1),
  body: z.string().min(1),
  cta: z.string().min(1),
  why_this_persona: z.string().describe("Why this persona warrants this ad — shown in UI"),
});

/**
 * Stage 4 output. One ad creative per picked persona.
 */
export const CreativesSchema = z.object({
  creatives: z.array(CreativeSchema).min(1).max(5),
});

export type Creative = z.infer<typeof CreativeSchema>;
export type Creatives = z.infer<typeof CreativesSchema>;
