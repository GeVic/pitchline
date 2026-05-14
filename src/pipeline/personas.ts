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
  return callClaudeJson({
    model: "haiku",
    system,
    user,
    schema: PersonasPickedSchema,
    maxTokens: 1500,
  });
}
