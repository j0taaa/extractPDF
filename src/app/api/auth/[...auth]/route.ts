import { betterAuth } from "better-auth";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { migrateToLatest } from "@/db/migrate";

const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL })
  })
});

async function ensureMigrated() {
  const { rows } = await sql<{
    exists: string | null;
  }>`select to_regclass('public.users') as exists`.execute(db);
  if (!rows[0]?.exists) {
    await migrateToLatest();
  }
}

if (process.env.NEXT_PHASE !== "phase-production-build") {
  await ensureMigrated();
}

const auth = betterAuth({
  database: { db, type: "postgres" },
  plugins: [nextCookies()],
  emailAndPassword: { enabled: true }
});

export const { GET, POST } = toNextJsHandler(auth);
