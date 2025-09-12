const { sql } = require("kysely");

/**
 * Bring the database schema in line with Better Auth defaults:
 * Tables: user, session, account, verification
 * Columns follow Better Auth's default field names (camelCase).
 *
 * @param {import('kysely').Kysely<any>} db
 */
async function up(db) {
  // Drop old/mismatched tables if they exist
  await sql`DROP TABLE IF EXISTS "authenticator" CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS "authenticators" CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS "verification_tokens" CASCADE; `.execute(db);
  await sql`DROP TABLE IF EXISTS "verification" CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS "user_keys" CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS "key" CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS "sessions" CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS "session" CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS "users" CASCADE;`.execute(db);
  await sql`DROP TABLE IF EXISTS "user" CASCADE;`.execute(db);

  // Create user
  await db.schema
    .createTable("user")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("email", "text", (col) => col.notNull().unique())
    .addColumn("emailVerified", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("image", "text")
    .addColumn("createdAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updatedAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Create session
  await db.schema
    .createTable("session")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("userId", "text", (col) => col.notNull().references("user.id").onDelete("cascade"))
    .addColumn("token", "text", (col) => col.notNull().unique())
    .addColumn("expiresAt", "timestamp", (col) => col.notNull())
    .addColumn("ipAddress", "text")
    .addColumn("userAgent", "text")
    .addColumn("createdAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updatedAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Create account (stores OAuth accounts and credential password)
  await db.schema
    .createTable("account")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("userId", "text", (col) => col.notNull().references("user.id").onDelete("cascade"))
    .addColumn("accountId", "text", (col) => col.notNull())
    .addColumn("providerId", "text", (col) => col.notNull())
    .addColumn("accessToken", "text")
    .addColumn("refreshToken", "text")
    .addColumn("idToken", "text")
    .addColumn("accessTokenExpiresAt", "timestamp")
    .addColumn("refreshTokenExpiresAt", "timestamp")
    .addColumn("scope", "text")
    .addColumn("password", "text")
    .addColumn("createdAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updatedAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("account_provider_unique", ["providerId", "accountId"])
    .execute();

  // Create verification
  await db.schema
    .createTable("verification")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("identifier", "text", (col) => col.notNull())
    .addColumn("value", "text", (col) => col.notNull())
    .addColumn("expiresAt", "timestamp", (col) => col.notNull())
    .addColumn("createdAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updatedAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
}

/**
 * @param {import('kysely').Kysely<any>} db
 */
async function down(db) {
  await db.schema.dropTable("verification").execute();
  await db.schema.dropTable("account").execute();
  await db.schema.dropTable("session").execute();
  await db.schema.dropTable("user").execute();
}

module.exports = { up, down };

