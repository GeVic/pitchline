import { MatchSchema, type Match, type Extract } from "@/schemas";
import { callClaudeJson, type CallResult } from "@/lib/claude";
import { publishers } from "@/lib/data";
import { loadPrompt } from "./_prompt";

export async function runMatch(extract: Extract): Promise<CallResult<Match>> {
  const system = await loadPrompt("match");
  const user = [
    "Extract (from stage 1):",
    JSON.stringify(extract, null, 2),
    "",
    "Catalog (full publisher list):",
    JSON.stringify(publishers, null, 2),
  ].join("\n");
  return callClaudeJson({
    model: "haiku",
    system,
    user,
    schema: MatchSchema,
    maxTokens: 2048,
  });
}
