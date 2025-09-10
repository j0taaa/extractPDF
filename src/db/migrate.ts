import { Kysely, PostgresDialect, Migrator, FileMigrationProvider } from "kysely";
import { Pool } from "pg";
import path from "path";
import { promises as fs } from "fs";

async function migrate() {
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
      migrationFolder: path.join(__dirname, "migrations")
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

migrate();
