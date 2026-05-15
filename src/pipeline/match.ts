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
  const result = await callClaudeJson({
    model: "haiku",
    system,
    user,
    schema: MatchSchema,
    maxTokens: 2048,
  });
  validateCatalog(result.parsed);
  return result;
}

/**
 * Zod can't catch a hallucinated publisher_id ("pub_021"). The schema accepts
 * any string. So after parsing we cross-check every id against the real
 * catalog and reject duplicates + cross-list appearances.
 */
function validateCatalog(match: Match): void {
  const validIds = new Set(publishers.map((p) => p.id));
  const seenInPicked = new Set<string>();
  const problems: string[] = [];

  for (const p of match.picked) {
    if (!validIds.has(p.publisher_id)) {
      problems.push(`unknown publisher_id in picked: ${p.publisher_id}`);
    } else if (seenInPicked.has(p.publisher_id)) {
      problems.push(`duplicate in picked: ${p.publisher_id}`);
    }
    seenInPicked.add(p.publisher_id);
  }
  for (const r of match.rejected) {
    if (!validIds.has(r.publisher_id)) {
      problems.push(`unknown publisher_id in rejected: ${r.publisher_id}`);
    } else if (seenInPicked.has(r.publisher_id)) {
      problems.push(
        `publisher_id in both picked and rejected: ${r.publisher_id}`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(`Stage 2 (match) catalog check failed: ${problems.join("; ")}`);
  }
}
