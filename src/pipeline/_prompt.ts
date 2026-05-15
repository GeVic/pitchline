import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Resolved once at module load (not per call), so subsequent process.chdir()
 * doesn't move the goal posts. Override with PROMPTS_DIR env var if the app
 * is started from outside the repo root.
 */
const PROMPTS_DIR = process.env.PROMPTS_DIR
  ? path.resolve(process.env.PROMPTS_DIR)
  : path.resolve(process.cwd(), "prompts");

const cache = new Map<string, string>();

export async function loadPrompt(name: string): Promise<string> {
  const cached = cache.get(name);
  if (cached) return cached;
  const content = await readFile(
    path.join(PROMPTS_DIR, `${name}.md`),
    "utf8",
  );
  cache.set(name, content);
  return content;
}
