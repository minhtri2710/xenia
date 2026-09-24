/** Name of the verification marker. Its value is a constant and carries no personal data. */
export const AGE_COOKIE = "xenia_age_ok";
export const AGE_COOKIE_VALUE = "1";

export const GATE_PATH = "/xac-minh-tuoi";
export const EXIT_PATH = "/tam-biet";

/** Storefront paths (without locale prefix) reachable without a declaration. */
export const UNGATED_PATHS: ReadonlySet<string> = new Set([GATE_PATH, EXIT_PATH]);
