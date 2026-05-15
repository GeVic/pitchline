#!/usr/bin/env node
/**
 * Pre-flight for `npm run dev`. Idempotent; safe to run on every server restart.
 *
 *  1. Ensure .env.local exists (copy from example if not)
 *  2. Ensure ANTHROPIC_API_KEY is set (env var OR non-placeholder .env.local entry)
 *  3. Ensure Docker is running
 *  4. Bring up the postgres container (docker compose up -d)
 *  5. Wait for postgres to accept connections
 *  6. Apply migrations
 *
 * Then `next dev` takes over via the npm script chain.
 */
import { existsSync, copyFileSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const ENV_PATH = ".env.local";
const ENV_EXAMPLE = ".env.local.example";

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};
const ok = (msg) => console.log(`${c.green("✓")} ${msg}`);
const info = (msg) => console.log(`${c.cyan("▸")} ${msg}`);
const fail = (msg) => {
  console.error(`\n${c.red("✗")} ${msg}\n`);
  process.exit(1);
};

// 1. Ensure .env.local exists
if (!existsSync(ENV_PATH)) {
  if (!existsSync(ENV_EXAMPLE)) {
    fail(`Missing ${ENV_EXAMPLE}. Re-clone the repository.`);
  }
  copyFileSync(ENV_EXAMPLE, ENV_PATH);
  ok(`Created ${ENV_PATH} from ${ENV_EXAMPLE}`);
}

// 2. Verify ANTHROPIC_API_KEY (env var or non-placeholder in .env.local)
const envContents = readFileSync(ENV_PATH, "utf8");
const fileKey = envContents.match(/^ANTHROPIC_API_KEY=(.*)$/m)?.[1]?.trim();
const envKey = process.env.ANTHROPIC_API_KEY;
const hasValidKey =
  (envKey && envKey.startsWith("sk-") && envKey.length > 20) ||
  (fileKey && fileKey.startsWith("sk-") && !fileKey.includes("xxx"));

if (!hasValidKey) {
  fail(
    `ANTHROPIC_API_KEY is not set.\n  Either:\n    • edit ${c.dim(ENV_PATH)} and replace the placeholder, or\n    • export ANTHROPIC_API_KEY=sk-... in your shell\n  Then re-run ${c.dim("npm run dev")}.`,
  );
}
ok("ANTHROPIC_API_KEY is set");

// 3. Docker daemon running?
try {
  execSync("docker info", { stdio: "ignore" });
} catch {
  fail(
    "Docker is not running. Start Docker Desktop / OrbStack and re-run `npm run dev`.",
  );
}
ok("Docker is running");

// 4. Start the postgres container (idempotent)
info("Starting postgres container");
execSync("docker compose up -d db", { stdio: "inherit" });

// 5. Wait for postgres to accept connections
info("Waiting for postgres to be ready");
const startedAt = Date.now();
const TIMEOUT_MS = 30_000;
while (true) {
  try {
    execSync("docker exec disco-db pg_isready -U postgres", {
      stdio: "ignore",
    });
    break;
  } catch {
    /* not ready yet */
  }
  if (Date.now() - startedAt > TIMEOUT_MS) {
    fail("Postgres did not become ready in 30s. Check `docker logs disco-db`.");
  }
  await sleep(500);
}
ok("Postgres ready");

// 6. Apply migrations (idempotent)
info("Applying migrations");
execSync("npx drizzle-kit migrate", { stdio: "inherit" });
ok("Migrations applied");

console.log(`\n${c.green("✓ Setup complete")} — starting next dev…\n`);
