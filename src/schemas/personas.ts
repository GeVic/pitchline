import { z } from "zod";

export const PersonaPickTagSchema = z.enum(["obvious", "adjacent", "non-obvious"]);

export const PersonaPickSchema = z.object({
  persona_id: z.string(),
  tag: PersonaPickTagSchema,
  why: z.string().describe("One-line justification visible to the user"),
});

/**
 * Stage 3 output. 3–5 personas picked from the catalog with tag + reasoning.
 */
export const PersonasPickedSchema = z.object({
  picked: z.array(PersonaPickSchema).min(1).max(5),
});

export type PersonaPickTag = z.infer<typeof PersonaPickTagSchema>;
export type PersonaPick = z.infer<typeof PersonaPickSchema>;
export type PersonasPicked = z.infer<typeof PersonasPickedSchema>;
