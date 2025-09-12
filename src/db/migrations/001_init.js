import { sql } from "kysely";

/**
 * @param {import('kysely').Kysely<any>} db
 */
export async function up(db) {
  await db.schema
    .createTable("users")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("email", "text", (col) => col.notNull().unique())
    .addColumn("hashed_password", "text")
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("sessions")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("expires_at", "timestamp", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("user_keys")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("provider_id", "text", (col) => col.notNull())
    .addColumn("provider_user_id", "text", (col) => col.notNull())
    .addColumn("hashed_password", "text")
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint(
      "user_keys_provider_unique",
      ["provider_id", "provider_user_id"]
    )
    .execute();

  await db.schema
    .createTable("verification_tokens")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("token", "text", (col) => col.notNull().unique())
    .addColumn("expires_at", "timestamp", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("authenticators")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("credential_id", "text", (col) => col.notNull().unique())
    .addColumn("public_key", "text", (col) => col.notNull())
    .addColumn("counter", "bigint", (col) => col.notNull().defaultTo(0))
    .addColumn("transports", "text")
    .execute();
  }

/**
 * @param {import('kysely').Kysely<any>} db
 */
export async function down(db) {
  await db.schema.dropTable("authenticators").execute();
  await db.schema.dropTable("verification_tokens").execute();
  await db.schema.dropTable("user_keys").execute();
  await db.schema.dropTable("sessions").execute();
  await db.schema.dropTable("users").execute();
}
