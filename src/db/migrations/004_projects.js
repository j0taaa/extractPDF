const { sql } = require("kysely");

/**
 * @param {import('kysely').Kysely<any>} db
 */
async function up(db) {
  await db.schema
    .createTable("project")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("ownerId", "text", (col) => col.notNull().references("user.id").onDelete("cascade"))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("createdAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updatedAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("project_owner_idx")
    .on("project")
    .column("ownerId")
    .execute();
}

/**
 * @param {import('kysely').Kysely<any>} db
 */
async function down(db) {
  await db.schema.dropIndex("project_owner_idx").ifExists().execute();
  await db.schema.dropTable("project").ifExists().execute();
}

module.exports = { up, down };

