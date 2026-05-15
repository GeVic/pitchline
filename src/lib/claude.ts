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

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 2;

export type CallResult<T> = {
  parsed: T;
  raw: string;
  prompt: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  durationMs: number;
  attempts: number;
};

export type CallOptions<T> = {
  model: ModelKey;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  /** Per-call wall-clock timeout. Defaults to 60s. */
  timeoutMs?: number;
  /** Total attempts including the first. Defaults to 2 (i.e. 1 retry). */
  maxAttempts?: number;
};

/**
 * Calls Claude with a JSON schema, retries on transient API errors and on
 * Zod / JSON validation failures (passing the validation error back to the
 * model so it can self-correct). Token counts + cost + duration accumulate
 * across attempts — failed tries still cost money, the trace should reflect
 * that.
 */
export async function callClaudeJson<T>(opts: CallOptions<T>): Promise<CallResult<T>> {
  const client = getClient();
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const price = PRICING_PER_MTOK_USD[opts.model];

  let validationFeedback = "";
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCost = 0;
  let totalDuration = 0;
  let lastError: unknown;
  let lastRaw = "";
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts += 1;
    const userMessage = validationFeedback
      ? `${opts.user}\n\n---\nYour previous attempt failed validation. Fix the issues below and return a valid JSON response.\n\n${validationFeedback}`
      : opts.user;

    const started = Date.now();
    let resp: Anthropic.Message;
    try {
      resp = await client.messages.create(
        {
          model: ModelId[opts.model],
          max_tokens: opts.maxTokens ?? 2048,
          system: opts.system,
          messages: [{ role: "user", content: userMessage }],
        },
        { timeout: timeoutMs },
      );
    } catch (err) {
      totalDuration += Date.now() - started;
      lastError = err;
      if (attempts < maxAttempts && isTransientError(err)) {
        await sleep(500 * attempts);
        continue;
      }
      throw err;
    }
    totalDuration += Date.now() - started;
    totalTokensIn += resp.usage.input_tokens;
    totalTokensOut += resp.usage.output_tokens;
    totalCost +=
      (resp.usage.input_tokens * price.input +
        resp.usage.output_tokens * price.output) /
      1_000_000;

    const raw = resp.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("");
    lastRaw = raw;
    const cleaned = stripJsonFences(raw);

    let json: unknown;
    try {
      json = JSON.parse(cleaned);
    } catch (err) {
      lastError = err;
      if (attempts < maxAttempts) {
        validationFeedback = `The response was not valid JSON. First 200 chars of your response:\n${cleaned.slice(0, 200)}`;
        continue;
      }
      throw new Error(
        `Model returned non-JSON text after ${attempts} attempt(s). First 200 chars: ${cleaned.slice(0, 200)}`,
        { cause: err },
      );
    }

    const result = opts.schema.safeParse(json);
    if (!result.success) {
      lastError = result.error;
      if (attempts < maxAttempts) {
        validationFeedback = formatZodFeedback(result.error);
        continue;
      }
      throw result.error;
    }

    return {
      parsed: result.data,
      raw: lastRaw,
      prompt: `[system]\n${opts.system}\n\n[user]\n${userMessage}`,
      model: ModelId[opts.model],
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      costUsd: totalCost,
      durationMs: totalDuration,
      attempts,
    };
  }

  // Unreachable: every loop path either returns or throws.
  throw lastError ?? new Error("callClaudeJson exhausted attempts without error");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatZodFeedback(err: z.ZodError): string {
  return err.errors
    .map((e) => `- ${e.path.join(".") || "(root)"}: ${e.message}`)
    .join("\n");
}

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as { status?: number }).status;
  if (typeof status === "number" && (status === 429 || status >= 500)) {
    return true;
  }
  return /timeout|aborted|network|ECONN|ETIMEDOUT|EAI_AGAIN/i.test(err.message);
}

function stripJsonFences(s: string): string {
  const trimmed = s.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}
