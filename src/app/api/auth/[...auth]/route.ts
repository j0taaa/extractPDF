import { betterAuth } from "better-auth";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { migrateToLatest } from "@/db/migrate";

const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL })
  })
});

// Run migrations at runtime (both dev and prod), but skip during build step
if (process.env.NEXT_PHASE !== "phase-production-build") {
  await migrateToLatest();
}

const auth = betterAuth({
  database: { db, type: "postgres" },
  plugins: [nextCookies()],
  emailAndPassword: { enabled: true }
});

export const { GET, POST } = toNextJsHandler(auth);
