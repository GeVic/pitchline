import { readFile } from "node:fs/promises";
import path from "node:path";
import { ExtractSchema, type Extract } from "@/schemas";
import { callClaudeJson, type CallResult } from "@/lib/claude";

let cachedPrompt: string | null = null;

async function loadPrompt(): Promise<string> {
  if (cachedPrompt) return cachedPrompt;
  cachedPrompt = await readFile(
    path.join(process.cwd(), "prompts/extract.md"),
    "utf8",
  );
  return cachedPrompt;
}

export async function runExtract(pitch: string): Promise<CallResult<Extract>> {
  const system = await loadPrompt();
  return callClaudeJson({
    model: "haiku",
    system,
    user: `Pitch:\n\n${pitch}`,
    schema: ExtractSchema,
    maxTokens: 1024,
  });
}
