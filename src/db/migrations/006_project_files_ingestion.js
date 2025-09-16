const { sql } = require("kysely");

/**
 * @param {import('kysely').Kysely<any>} db
 */
async function up(db) {
  await db.schema
    .alterTable("project")
    .addColumn("apiIngestionEnabled", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("apiToken", "text")
    .execute();

  await db.schema
    .createTable("projectFile")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("projectId", "text", (col) =>
      col.notNull().references("project.id").onDelete("cascade")
    )
    .addColumn("ownerId", "text", (col) =>
      col.notNull().references("user.id").onDelete("cascade")
    )
    .addColumn("originalName", "text", (col) => col.notNull())
    .addColumn("storagePath", "text", (col) => col.notNull())
    .addColumn("contentType", "text")
    .addColumn("size", "bigint", (col) => col.notNull())
    .addColumn("uploadedViaApi", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("createdAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("project_file_project_idx")
    .on("projectFile")
    .column("projectId")
    .execute();
}

/**
 * @param {import('kysely').Kysely<any>} db
 */
async function down(db) {
  await db.schema.dropIndex("project_file_project_idx").ifExists().execute();
  await db.schema.dropTable("projectFile").ifExists().execute();
  await db.schema
    .alterTable("project")
    .dropColumn("apiToken")
    .dropColumn("apiIngestionEnabled")
    .execute();
}

module.exports = { up, down };
