// Kept free of Zod so client components can import it without pulling the
// validation library into the browser bundle.

export const LEVELS = ["intern", "junior", "mid", "senior", "staff"] as const;

export type Level = (typeof LEVELS)[number];

/** Sensible default level from years of experience. The user can override it. */
export function suggestLevel(years: number | null): Level {
  if (years === null || years < 3) return "junior";
  if (years < 6) return "mid";
  if (years < 10) return "senior";
  return "staff";
}
