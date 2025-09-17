import { DEFAULT_TOKEN_SAFETY_LIMIT, parseTokenSafetyLimit } from "@/lib/token-limit";

export function getDefaultTokenSafetyLimit(): number {
  const candidate = Number.parseInt(
    process.env.OPENROUTER_MAX_TOKENS_PER_RUN ?? `${DEFAULT_TOKEN_SAFETY_LIMIT}`,
    10
  );
  return parseTokenSafetyLimit(candidate, DEFAULT_TOKEN_SAFETY_LIMIT);
}
