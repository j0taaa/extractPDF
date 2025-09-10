import { betterAuth } from "better-auth";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL })
  })
});

const auth = betterAuth({
  database: { db, type: "postgres" },
  plugins: [nextCookies()],
  emailAndPassword: { enabled: true }
});

export const { GET, POST } = toNextJsHandler(auth);
