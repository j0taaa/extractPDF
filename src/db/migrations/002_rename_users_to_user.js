const { sql } = require("kysely");

/**
 * @param {import('kysely').Kysely<any>} db
 */
async function up(db) {
  // Drop existing foreign keys on dependent tables before renaming
  await sql`ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;`.execute(db);
  await sql`ALTER TABLE "user_keys" DROP CONSTRAINT IF EXISTS user_keys_user_id_fkey;`.execute(db);
  await sql`ALTER TABLE "verification_tokens" DROP CONSTRAINT IF EXISTS verification_tokens_user_id_fkey;`.execute(db);
  await sql`ALTER TABLE "authenticators" DROP CONSTRAINT IF EXISTS authenticators_user_id_fkey;`.execute(db);

  // Rename primary table and dependents to Better Auth defaults
  await sql`ALTER TABLE "users" RENAME TO "user";`.execute(db);
  await sql`ALTER TABLE "sessions" RENAME TO "session";`.execute(db);
  await sql`ALTER TABLE "user_keys" RENAME TO "key";`.execute(db);
  await sql`ALTER TABLE "verification_tokens" RENAME TO "verification";`.execute(db);
  await sql`ALTER TABLE "authenticators" RENAME TO "authenticator";`.execute(db);

  // Recreate foreign keys pointing to the renamed primary table
  await sql`ALTER TABLE "session" ADD CONSTRAINT session_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;`.execute(db);
  await sql`ALTER TABLE "key" ADD CONSTRAINT key_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;`.execute(db);
  await sql`ALTER TABLE "verification" ADD CONSTRAINT verification_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;`.execute(db);
  await sql`ALTER TABLE "authenticator" ADD CONSTRAINT authenticator_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;`.execute(db);
}

/**
 * @param {import('kysely').Kysely<any>} db
 */
async function down(db) {
  // Drop FKs from renamed tables
  await sql`ALTER TABLE "session" DROP CONSTRAINT IF EXISTS session_user_id_fkey;`.execute(db);
  await sql`ALTER TABLE "key" DROP CONSTRAINT IF EXISTS key_user_id_fkey;`.execute(db);
  await sql`ALTER TABLE "verification" DROP CONSTRAINT IF EXISTS verification_user_id_fkey;`.execute(db);
  await sql`ALTER TABLE "authenticator" DROP CONSTRAINT IF EXISTS authenticator_user_id_fkey;`.execute(db);

  // Rename tables back to original names
  await sql`ALTER TABLE "user" RENAME TO "users";`.execute(db);
  await sql`ALTER TABLE "session" RENAME TO "sessions";`.execute(db);
  await sql`ALTER TABLE "key" RENAME TO "user_keys";`.execute(db);
  await sql`ALTER TABLE "verification" RENAME TO "verification_tokens";`.execute(db);
  await sql`ALTER TABLE "authenticator" RENAME TO "authenticators";`.execute(db);

  // Recreate original foreign keys
  await sql`ALTER TABLE "sessions" ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES "users"(id) ON DELETE CASCADE;`.execute(db);
  await sql`ALTER TABLE "user_keys" ADD CONSTRAINT user_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES "users"(id) ON DELETE CASCADE;`.execute(db);
  await sql`ALTER TABLE "verification_tokens" ADD CONSTRAINT verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES "users"(id) ON DELETE CASCADE;`.execute(db);
  await sql`ALTER TABLE "authenticators" ADD CONSTRAINT authenticators_user_id_fkey FOREIGN KEY (user_id) REFERENCES "users"(id) ON DELETE CASCADE;`.execute(db);
}

module.exports = { up, down };

