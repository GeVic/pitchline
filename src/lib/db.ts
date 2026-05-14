import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/drizzle/schema";

declare global {
  // eslint-disable-next-line no-var
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.local.example to .env.local and start the db with `npm run db:up`.",
    );
  }
  const client = globalThis.__pgClient ?? postgres(databaseUrl);
  if (process.env.NODE_ENV !== "production") {
    globalThis.__pgClient = client;
  }
  _db = drizzle(client, { schema });
  return _db;
}

export { schema };
