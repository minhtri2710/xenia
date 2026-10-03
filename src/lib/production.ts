/**
 * Production guards. The app is pre-launch: these refuse what must never reach a real deploy
 * (the dev placeholders from `.env.example`, the mock payment) instead of letting it run quietly.
 */

/** The placeholder values in `.env.example`; a production server refuses to serve with them. */
export const DEV_PAYLOAD_SECRET = "dev-only-placeholder-not-a-real-secret";
export const DEV_DATABASE_PASSWORD = "xenia-dev-only";
export const MIN_SECRET_LENGTH = 32;

type Env = Partial<Record<"NODE_ENV" | "NEXT_PHASE" | "PAYLOAD_SECRET" | "DATABASE_URI", string>>;

/**
 * The problems that stop a production server from serving, empty when there are none. Only a
 * running production server is checked: development, tests and `next build` (which runs with
 * NODE_ENV=production but serves nothing) keep the dev placeholders.
 */
export function productionEnvProblems(env: Env): string[] {
  if (env.NODE_ENV !== "production" || env.NEXT_PHASE === "phase-production-build") return [];
  const problems: string[] = [];
  const secret = env.PAYLOAD_SECRET ?? "";
  if (secret === DEV_PAYLOAD_SECRET) problems.push("PAYLOAD_SECRET is the development placeholder from .env.example.");
  else if (secret.length < MIN_SECRET_LENGTH) problems.push(`PAYLOAD_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
  if ((env.DATABASE_URI ?? "").includes(DEV_DATABASE_PASSWORD)) problems.push("DATABASE_URI uses the development password from .env.example.");
  return problems;
}

/** Throws when the mock payment would run in production: no payment provider is configured. */
export function assertMockPaymentAllowed(production: boolean): void {
  if (production) throw new Error("The mock payment never runs in production: no payment provider is configured.");
}
