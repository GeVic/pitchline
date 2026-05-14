import { NextResponse } from "next/server";
import { z } from "zod";
import { runPipeline } from "@/pipeline/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  pitch: z.string().trim().min(3, "Pitch is too short").max(2000),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  try {
    const result = await runPipeline(parsed.data.pitch);
    return NextResponse.json(result, {
      status: result.status === "completed" ? 200 : 500,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
