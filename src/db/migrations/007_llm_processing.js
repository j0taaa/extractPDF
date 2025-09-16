const { sql } = require("kysely");

/**
 * @param {import('kysely').Kysely<any>} db
 */
async function up(db) {
  await db.schema
    .createTable("projectProcessingRun")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("projectId", "text", (col) =>
      col.notNull().references("project.id").onDelete("cascade")
    )
    .addColumn("fileId", "text", (col) =>
      col.notNull().references("projectFile.id").onDelete("cascade")
    )
    .addColumn("instructionSet", "text")
    .addColumn("customPrompt", "text")
    .addColumn("model", "text")
    .addColumn("temperature", "numeric")
    .addColumn("fileType", "text")
    .addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
    .addColumn("error", "text")
    .addColumn("warnings", "jsonb")
    .addColumn("aggregatedOutput", "jsonb")
    .addColumn("usageSummary", "jsonb")
    .addColumn("attempts", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("createdAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updatedAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("startedAt", "timestamp")
    .addColumn("completedAt", "timestamp")
    .execute();

  await db.schema
    .createIndex("processing_run_project_idx")
    .on("projectProcessingRun")
    .column("projectId")
    .execute();

  await db.schema
    .createIndex("processing_run_file_idx")
    .on("projectProcessingRun")
    .column("fileId")
    .execute();

  await db.schema
    .createTable("projectProcessingPage")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("runId", "text", (col) =>
      col.notNull().references("projectProcessingRun.id").onDelete("cascade")
    )
    .addColumn("pageNumber", "integer", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
    .addColumn("statusCode", "integer")
    .addColumn("entries", "jsonb")
    .addColumn("rawResponse", "text")
    .addColumn("warnings", "jsonb")
    .addColumn("error", "text")
    .addColumn("usage", "jsonb")
    .addColumn("createdAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updatedAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("processing_page_run_idx")
    .on("projectProcessingPage")
    .column("runId")
    .execute();

  await db.schema
    .createTable("projectProcessingEvent")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("runId", "text", (col) =>
      col.notNull().references("projectProcessingRun.id").onDelete("cascade")
    )
    .addColumn("level", "text", (col) => col.notNull().defaultTo("info"))
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("context", "jsonb")
    .addColumn("createdAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("processing_event_run_idx")
    .on("projectProcessingEvent")
    .column("runId")
    .execute();
}

/**
 * @param {import('kysely').Kysely<any>} db
 */
async function down(db) {
  await db.schema.dropIndex("processing_event_run_idx").ifExists().execute();
  await db.schema.dropTable("projectProcessingEvent").ifExists().execute();
  await db.schema.dropIndex("processing_page_run_idx").ifExists().execute();
  await db.schema.dropTable("projectProcessingPage").ifExists().execute();
  await db.schema.dropIndex("processing_run_file_idx").ifExists().execute();
  await db.schema.dropIndex("processing_run_project_idx").ifExists().execute();
  await db.schema.dropTable("projectProcessingRun").ifExists().execute();
}

module.exports = { up, down };
