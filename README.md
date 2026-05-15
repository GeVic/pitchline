# Pitchline

Paste a one-line advertiser pitch and the system gives you back ranked publisher picks with reasoning, a few persona-tuned ad creatives, and a structured campaign config. 

## Run it locally

You need Docker running, Node 20+, and an Anthropic API key.

```bash
npm install
npm run dev                            # http://localhost:3000
```

`npm run dev` creates `.env.local` from the example, brings up the postgres container, waits for it, applies migrations, then starts the dev server. On first run it will tell you to add your `ANTHROPIC_API_KEY` to `.env.local` (or export it in your shell) and re-run.

## What it does

Each stage owns its prompt (in `prompts/`), its Zod schema, and a row in `stages` that's enough to reproduce it later.

1. **Extract** (Haiku 4.5). Parses the pitch into category, price tier, business model, audience hints, positive and negative signals, confidence, and clarifying questions.
2. **Match** (Haiku 4.5). Picks 1 to 6 publishers with scores and reasons, plus a "considered but rejected" list.
3. **Personas** (Haiku 4.5). Picks 1 to 5 personas tagged `obvious`, `adjacent`, or `non-obvious` with a one-line why.
4. **Creative** (Sonnet 4.6). One ad per picked persona, tuned to that persona's preferences. Sonnet because copy quality matters.
5. **Config** (pure code). Assembles the final campaign with name, objective, daily budget, pricing, bid range, targeting, placements (budget shares sum to 1.0), and creatives.

## What I'd do with another week

- **Decouple stages from the request path** so runs survive disconnects.
- **Retrieval over embeddings** in stage 2, so the pipeline scales beyond a hardcoded catalog.
- **Prompt versioning** per run, so replays and A/B comparisons stay honest.
- **Multi-tenancy** with per-tenant quotas, spend caps, and tier-based model routing.
- **Auth.** The endpoint is open today.

## What I intentionally cut

- **Auth and multi-user.** Lands with the multi-tenancy work above.
- **Embeddings + retrieval + LLM rerank.** Inline catalog at 20 publishers is faster and simpler.
- **Tool-use / function-calling.** Plain JSON with Zod plus retry-on-validation is enough at this scale.
- **Per-placement creative assignment.** Schema supports it. Every placement currently gets every creative.
- **Token-level streaming within a stage.** Stage-level streaming was enough to kill the 25-second spinner.
- **Tests.**

## Where the engineering lives

Arriving at the pipeline shape was easy. Making it reliably produce correct output is harder. That means steering each stage to receive the right upstream context, writing prompts disciplined enough that small rewordings don't drift the response, and deciding what "correct" means given a brief that deliberately includes "idk just try it." Because LLM behavior is fragile to tiny prompt changes, full-fidelity debug stops being a developer convenience and becomes an architectural differentiator. `/debug/[runId]` saves every prompt, response, parsed output, retry, and validation outcome per stage. At scale this would need eval sets, prompt versioning, confidence and cost time series per stage, and outlier alerting on regressions. That operational side doesn't exist today and is where most of the real work would live.
