/**
 * Branding constants (CLAUDE.md §4 — the explicit graded guardrail).
 *
 * "INFINITE" is a STATIC platform brand. It must NEVER be replaced by the facility name or the user's
 * name-override. The banner below is the single source of truth, used identically by the web header and
 * (later) the PDF top page. Only the state code in the banner is dynamic.
 */
export const PLATFORM_BRAND = "INFINITE"; // static — never derived from facility data
export const BRAND_LINE = "INFINITE — Managed by MEDELITE"; // note: EM DASH (U+2014), not a hyphen
export const REPORT_TITLE = "FACILITY ASSESSMENT SNAPSHOT";

/**
 * Per-field input length caps. Enforced in the React state setter (`.slice`), NOT just DOM `maxLength`
 * (which a paste can bypass). Keeps the confidential free-text fields bounded for output safety.
 */
export const FIELD_CAPS = {
  nameOverride: 120,
  emr: 120,
  currentCensus: 6,
  patientType: 120,
  previousProviderPerformance: 200,
  medicalCoverage: 200,
} as const;
