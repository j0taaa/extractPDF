import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { migrateToLatest } from "@/db/migrate";

let dbInstance: Kysely<unknown> | null = null;

export function getDb(): Kysely<unknown> {
  if (!dbInstance) {
    dbInstance = new Kysely({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL })
      })
    });

    if (process.env.NEXT_PHASE !== "phase-production-build") {
      // Run migrations lazily on first DB access in runtime
      // no top-level await here; fire and forget
      migrateToLatest().catch((err) => {
        console.error("Migration failed:", err);
      });
    }
  }
  return dbInstance;
}

