import { Kysely, PostgresDialect, Migrator, FileMigrationProvider } from "kysely";
import { Pool } from "pg";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

export async function migrateToLatest() {
  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: process.env.DATABASE_URL })
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

  results?.forEach((result) => {
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
