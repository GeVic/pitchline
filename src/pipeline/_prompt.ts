import { readFile } from "node:fs/promises";
import path from "node:path";

const cache = new Map<string, string>();

export async function loadPrompt(name: string): Promise<string> {
  const cached = cache.get(name);
  if (cached) return cached;
  const content = await readFile(
    path.join(process.cwd(), "prompts", `${name}.md`),
    "utf8",
  );
  cache.set(name, content);
  return content;
}
