import { z } from "zod";
import { runPipelineStream } from "@/pipeline/run";
import { getClientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  pitch: z.string().trim().min(3, "Pitch is too short").max(2000),
});

const RATE_LIMIT = { max: 10, windowMs: 60_000 };

export async function POST(req: Request) {
  const rl = rateLimit(getClientKey(req), RATE_LIMIT);
  if (!rl.allowed) {
    return Response.json(
      {
        error: `Too many requests. Try again in ${rl.retryAfterSeconds}s.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSeconds),
          "X-RateLimit-Limit": String(RATE_LIMIT.max),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (eventType: string, data: unknown) => {
        const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };
      try {
        for await (const ev of runPipelineStream(parsed.data.pitch)) {
          send(ev.type, ev);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
