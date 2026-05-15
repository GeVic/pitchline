import {
  CreativesSchema,
  type Creatives,
  type Extract,
  type PersonasPicked,
} from "@/schemas";
import { callClaudeJson, type CallResult } from "@/lib/claude";
import { personaById } from "@/lib/data";
import { loadPrompt } from "./_prompt";

export async function runCreative(
  extract: Extract,
  picked: PersonasPicked,
): Promise<CallResult<Creatives>> {
  const system = await loadPrompt("creative");
  const fullPersonas = picked.picked.flatMap((p) => {
    const record = personaById.get(p.persona_id);
    return record ? [{ ...record, tag: p.tag, why_picked: p.why }] : [];
  });
  if (fullPersonas.length === 0) {
    throw new Error("Stage 4 had no picked personas to write creative for.");
  }
  const user = [
    "Extract (from stage 1):",
    JSON.stringify(extract, null, 2),
    "",
    "Personas to write creative for (full records, in pick order):",
    JSON.stringify(fullPersonas, null, 2),
  ].join("\n");
  const result = await callClaudeJson({
    model: "sonnet",
    system,
    user,
    schema: CreativesSchema,
    maxTokens: 2500,
  });

  // Sanity check: each creative must reference one of the personas we picked.
  const expected = new Set(picked.picked.map((p) => p.persona_id));
  const stray = result.parsed.creatives
    .map((c) => c.persona_id)
    .filter((id) => !expected.has(id));
  if (stray.length > 0) {
    throw new Error(
      `Stage 4 (creative) referenced personas not in the picked set: ${stray.join(", ")}`,
    );
  }
  return result;
}
