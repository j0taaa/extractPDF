import { betterAuth } from "better-auth";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import { getDb } from "@/db/client";

const auth = betterAuth({
  database: { db: getDb(), type: "postgres" },
  plugins: [nextCookies()],
  emailAndPassword: { enabled: true }
});

export const { GET, POST } = toNextJsHandler(auth);
export { auth };
