# Pitchline

Paste a one-line advertiser pitch and the system gives you back ranked publisher picks with reasoning, a few persona-tuned ad creatives, and a structured campaign config. 

## Run it locally

You need Docker, Node 20+, and an Anthropic API key.

```bash
docker compose up -d db
npm install
cp .env.local.example .env.local       # fill in ANTHROPIC_API_KEY
npm run db:migrate
npm run dev                            # http://localhost:3000
```

## What it does

Each stage owns its prompt file (in `prompts/`), its Zod schema, and a row in the `stages` table that's enough to reproduce it later.

1. **Extract** (Haiku 4.5). Parses the pitch into category, price tier, business model, audience hints, positive signals, signals to avoid, confidence, and clarifying questions.
2. **Match** (Haiku 4.5). Scores 1 to 6 publishers from the catalog and a "considered but rejected" list, both with reasons citing specific publisher fields.
3. **Personas** (Haiku 4.5). Picks 1 to 5 personas tagged as `obvious`, `adjacent`, or `non-obvious` with a one-line justification each.
4. **Creative** (Sonnet 4.6). Writes one ad per picked persona, tuned to that persona's `messaging_preferences` and `disinterested_in`. Sonnet because copy quality matters here.
5. **Config** (pure code). Assembles campaign name, objective, daily budget, pricing model, bid range, targeting, placements with `budget_share` summing to exactly 1.0, and the picked creatives. No LLM, because LLMs are bad at arithmetic.

## What I'd do with another week

- **Decouple stages from the request path.** Move the orchestrator into a background runner so runs survive disconnects and multiple consumers can subscribe to the same run.
- **Retrieval over embeddings.** Replace the inline catalog scoring in stage 2 with a vector retrieval step so the pipeline scales beyond a hardcoded catalog size.
- **Prompt versioning.** Hash and pin each prompt per run so trace replays and A/B comparisons stay honest as prompts evolve.
- **Multi-tenancy.** Per-tenant quotas, spend caps, and tier-based model routing so one runaway pitch can't burn everyone's budget.
- **Auth.** The endpoint is open today. Anyone with the URL can spend tokens.

## What I intentionally cut

- **Auth and multi-user.** Take-home didn't need it. Would land alongside the multi-tenancy work above.
- **Embeddings + retrieval + LLM rerank.** Real ad-platform shape is retrieve-then-rerank, but at 20 publishers the inline catalog is faster and simpler.
- **Tool-use / function-calling.** Plain JSON with Zod plus retry-on-validation is good enough at this scale.
- **Per-placement creative assignment.** Schema supports per-placement creative lists. Today every placement gets every creative.
- **Token-level streaming within a stage.** Stage-level streaming killed the 25-second spinner. Per-token would have tripled surface area for marginal gain.
- **Tests.**

## What's genuinely hard vs. easy

Arriving at the pipeline shape was the easy part. Five stages, schemas at the boundaries, an orchestrator wiring them together. Getting a working pipeline was tractable. The harder problem is making it reliably produce correct output, which means steering each stage so it receives exactly the upstream context it needs, writing prompts disciplined enough that small rewordings don't drift the response, and deciding what "correct" even means given a brief that deliberately includes "idk just try it" as a test pitch. Because LLM behavior is fragile to tiny prompt changes, full-fidelity debug stops being a developer convenience and becomes an architectural differentiator. `/debug/[runId]` saves every prompt, raw response, parsed output, retry attempt, and validation outcome per stage, which is the only way to honestly answer "why did this run produce that?". It isn't production-grade observability, and at scale this would need eval sets over reference pitches, prompt versioning, per-stage confidence and cost time series, and outlier alerting on regressions. That whole operational side of the system doesn't exist today and is where most of the real work would live once it shipped.
