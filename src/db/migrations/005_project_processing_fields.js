/**
 * @param {import('kysely').Kysely<any>} db
 */
async function up(db) {
  await db.schema
    .alterTable("project")
    .addColumn("fileType", "text", (col) => col.notNull().defaultTo('pdf'))
    .addColumn("instructionSet", "text", (col) => col.notNull().defaultTo('ocr_all_text'))
    .addColumn("customPrompt", "text")
    .execute();
}

/**
 * @param {import('kysely').Kysely<any>} db
 */
async function down(db) {
  await db.schema
    .alterTable("project")
    .dropColumn("customPrompt")
    .dropColumn("instructionSet")
    .dropColumn("fileType")
    .execute();
}

module.exports = { up, down };
