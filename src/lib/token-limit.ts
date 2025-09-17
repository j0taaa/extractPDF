export const MIN_TOKEN_SAFETY_LIMIT = 1000;
export const MAX_TOKEN_SAFETY_LIMIT = 1_000_000;
export const DEFAULT_TOKEN_SAFETY_LIMIT = 100_000;

export function clampTokenSafetyLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TOKEN_SAFETY_LIMIT;
  }
  const rounded = Math.round(value);
  if (Number.isNaN(rounded)) {
    return DEFAULT_TOKEN_SAFETY_LIMIT;
  }
  return Math.min(Math.max(rounded, MIN_TOKEN_SAFETY_LIMIT), MAX_TOKEN_SAFETY_LIMIT);
}

export function parseTokenSafetyLimit(
  value: unknown,
  fallback: number = DEFAULT_TOKEN_SAFETY_LIMIT
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampTokenSafetyLimit(value);
  }
  if (typeof value === "bigint") {
    return clampTokenSafetyLimit(Number(value));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return clampTokenSafetyLimit(parsed);
    }
  }
  return clampTokenSafetyLimit(fallback);
}
