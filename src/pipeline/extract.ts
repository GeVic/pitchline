import { ExtractSchema, type Extract } from "@/schemas";
import { callClaudeJson, type CallResult } from "@/lib/claude";
import { loadPrompt } from "./_prompt";

export async function runExtract(pitch: string): Promise<CallResult<Extract>> {
  const system = await loadPrompt("extract");
  return callClaudeJson({
    model: "haiku",
    system,
    user: `Pitch:\n\n${pitch}`,
    schema: ExtractSchema,
    maxTokens: 1024,
  });
}
