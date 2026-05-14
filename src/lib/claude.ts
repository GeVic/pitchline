import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

declare global {
  // eslint-disable-next-line no-var
  var __anthropicClient: Anthropic | undefined;
}

function getClient(): Anthropic {
  if (globalThis.__anthropicClient) return globalThis.__anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.local.example to .env.local and fill it in.",
    );
  }
  const client = new Anthropic({ apiKey });
  if (process.env.NODE_ENV !== "production") {
    globalThis.__anthropicClient = client;
  }
  return client;
}

export const ModelId = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
} as const;

export type ModelKey = keyof typeof ModelId;

const PRICING_PER_MTOK_USD: Record<ModelKey, { input: number; output: number }> = {
  haiku: { input: 1.0, output: 5.0 },
  sonnet: { input: 3.0, output: 15.0 },
};

export type CallResult<T> = {
  parsed: T;
  raw: string;
  prompt: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  durationMs: number;
};

export type CallOptions<T> = {
  model: ModelKey;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
};

export async function callClaudeJson<T>(opts: CallOptions<T>): Promise<CallResult<T>> {
  const client = getClient();
  const started = Date.now();
  const resp = await client.messages.create({
    model: ModelId[opts.model],
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  const durationMs = Date.now() - started;

  const raw = resp.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");

  const cleaned = stripJsonFences(raw);
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Model returned non-JSON text. First 200 chars: ${cleaned.slice(0, 200)}`,
      { cause: err },
    );
  }
  const parsed = opts.schema.parse(json);

  const tokensIn = resp.usage.input_tokens;
  const tokensOut = resp.usage.output_tokens;
  const price = PRICING_PER_MTOK_USD[opts.model];
  const costUsd = (tokensIn * price.input + tokensOut * price.output) / 1_000_000;

  return {
    parsed,
    raw,
    prompt: `[system]\n${opts.system}\n\n[user]\n${opts.user}`,
    model: ModelId[opts.model],
    tokensIn,
    tokensOut,
    costUsd,
    durationMs,
  };
}

function stripJsonFences(s: string): string {
  const trimmed = s.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}
