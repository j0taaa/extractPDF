/**
 * @param {import('kysely').Kysely<any>} db
 */
async function up(db) {
  await db.schema
    .alterTable("project")
    .addColumn("tokenSafetyLimit", "integer", (col) => col.notNull().defaultTo(100000))
    .execute();
}

/**
 * @param {import('kysely').Kysely<any>} db
 */
async function down(db) {
  await db.schema
    .alterTable("project")
    .dropColumn("tokenSafetyLimit")
    .execute();
}

module.exports = { up, down };
