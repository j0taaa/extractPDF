// @ts-nocheck
import { Kysely, PostgresDialect, Migrator, FileMigrationProvider, type MigrationResult } from "kysely";
import { Pool } from "pg";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

function toAdminUrl(databaseUrl: string): { adminUrl: string; databaseName: string } {
  const url = new URL(databaseUrl);
  const databaseName = url.pathname.replace(/^\//, "");
  // connect to the default "postgres" database to perform admin operations
  url.pathname = "/postgres";
  return { adminUrl: url.toString(), databaseName };
}

async function ensureDatabaseExists(): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  const { adminUrl, databaseName } = toAdminUrl(databaseUrl);

  const adminPool = new Pool({ connectionString: adminUrl });
  try {
    const existsResult = await adminPool.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [databaseName]
    );
    const exists = existsResult.rows[0]?.exists === true;
    if (!exists) {
      console.log(`Database "${databaseName}" does not exist. Creating...`);
      await adminPool.query(`CREATE DATABASE "${databaseName}"`);
      console.log(`Database "${databaseName}" created.`);
    }
  } finally {
    await adminPool.end().catch(() => undefined);
  }
}

async function waitForDatabaseReady(maxRetries = 30, delayMs = 1000): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const pool = new Pool({ connectionString: databaseUrl });
      await pool.query("SELECT 1");
      await pool.end();
      return; // success
    } catch (err) {
      attempt += 1;
      if (attempt >= maxRetries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export async function migrateToLatest() {
  await ensureDatabaseExists();
  await waitForDatabaseReady();

  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: getDatabaseUrl() })
    })
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(process.cwd(), "src", "db", "migrations")
    })
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((result: MigrationResult) => {
    if (result.status === "Success") {
      console.log(`migration "${result.migrationName}" was successful`);
    } else if (result.status === "Error") {
      console.error(`migration "${result.migrationName}" failed`);
    }
  });

  if (error) {
    console.error("failed to migrate", error);
    process.exit(1);
  }

  await db.destroy();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrateToLatest();
}
