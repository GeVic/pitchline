import {
  PersonasPickedSchema,
  type PersonasPicked,
  type Extract,
  type Match,
} from "@/schemas";
import { callClaudeJson, type CallResult } from "@/lib/claude";
import { personas } from "@/lib/data";
import { loadPrompt } from "./_prompt";

export async function runPersonas(
  extract: Extract,
  match: Match,
): Promise<CallResult<PersonasPicked>> {
  const system = await loadPrompt("personas");
  const user = [
    "Extract (from stage 1):",
    JSON.stringify(extract, null, 2),
    "",
    "Match (from stage 2):",
    JSON.stringify(match, null, 2),
    "",
    "Personas (full catalog):",
    JSON.stringify(personas, null, 2),
  ].join("\n");
  const result = await callClaudeJson({
    model: "haiku",
    system,
    user,
    schema: PersonasPickedSchema,
    maxTokens: 1500,
  });
  validateCatalog(result.parsed);
  return result;
}

function validateCatalog(picks: PersonasPicked): void {
  const validIds = new Set(personas.map((p) => p.id));
  const seen = new Set<string>();
  const problems: string[] = [];

  for (const p of picks.picked) {
    if (!validIds.has(p.persona_id)) {
      problems.push(`unknown persona_id: ${p.persona_id}`);
    } else if (seen.has(p.persona_id)) {
      problems.push(`duplicate persona_id: ${p.persona_id}`);
    }
    seen.add(p.persona_id);
  }

  if (problems.length > 0) {
    throw new Error(`Stage 3 (personas) catalog check failed: ${problems.join("; ")}`);
  }
}
