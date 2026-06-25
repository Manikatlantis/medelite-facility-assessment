/**
 * CMS Provider Data Catalog — data engine (Slice 1).
 *
 * SECURITY-CRITICAL CONSTANTS (CLAUDE.md §6): the upstream host, path, dataset id, query property, and
 * operator are HARDCODED here and must NEVER be made dynamic from request input. Doing so would turn this
 * proxy into an SSRF / open-relay surface. The ONLY dynamic value that reaches the upstream is the CCN,
 * which is strictly validated and passed solely as an encoded query *value* (never into the URL path).
 */

import { isValidCcn } from "./ccn";
export { isValidCcn, CCN_REGEX } from "./ccn";
import {
  AVG_COLUMN,
  METRIC_CODES,
  type FacilityMetrics,
  type MetricCode,
  type MetricValues,
} from "./metrics";

const CMS_QUERY_BASE = "https://data.cms.gov/provider-data/api/1/datastore/query";
const PROVIDER_INFO_DATASET = "4pq5-n9py"; // verified live
const CLAIMS_DATASET = "ijh5-nb2v"; // Medicare Claims Quality Measures (bonus)
const STATE_AVG_DATASET = "xcdc-v8bm"; // State US Averages (bonus)
const CCN_PROPERTY = "cms_certification_number_ccn";
const STATE_PROPERTY = "state_or_nation";
const EQ = "=";
const UPSTREAM_TIMEOUT_MS = 7000;
const USER_AGENT =
  "Medelite-Facility-Assessment/1.0 (+facility report generator; contact: maniksharma434343@gmail.com)";

export type StarRating = number | null; // integer 1..5, or null = "Not Rated"

export interface ProviderInfo {
  ccn: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null; // 2-letter postal code, drives the dynamic header + the state-average join
  zip: string | null;
  location: string; // composed, display-ready
  certifiedBeds: number | null;
  ratings: {
    overall: StarRating;
    healthInspection: StarRating;
    staffing: StarRating;
    qualityOfResidentCare: StarRating;
  };
  averageResidentsPerDay: number | null; // CMS analog to "Current Census" (manual field) — reference only
  processingDate: string | null; // "data as of" stamp
}

export type ProviderLookup =
  | { ok: true; data: ProviderInfo }
  | { ok: false; reason: "not_found" };

// ---- The CMS response is UNTRUSTED input (numerics arrive as strings; fields can be ""/null). ----

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v : String(v);
  const t = s.trim();
  return t === "" ? null : t;
}

function num(v: unknown): number | null {
  const s = str(v);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null; // guard "" -> NOT 0; NaN -> null
}

function rating(v: unknown): StarRating {
  const n = num(v);
  if (n == null) return null;
  const r = Math.trunc(n);
  return r >= 1 && r <= 5 ? r : null; // clamp to the valid star domain; anything else = Not Rated
}

function composeLocation(
  address: string | null,
  city: string | null,
  state: string | null,
  zip: string | null,
): string {
  const left = [address, city].filter(Boolean).join(", "); // "5280 SW 157 Avenue, Miami"
  const right = [state, zip].filter(Boolean).join(" "); // "FL 33185"
  return [left, right].filter(Boolean).join(", "); // "..., FL 33185"
}

/**
 * Low-level datastore query. SECURITY: datasetId and each condition's property/operator are caller-supplied
 * CONSTANTS only; the single dynamic value is encoded by URLSearchParams and never enters the URL path.
 */
async function cmsQuery(
  datasetId: string,
  conditions: { property: string; value: string; operator: string }[],
  limit: number,
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams();
  conditions.forEach((c, i) => {
    params.append(`conditions[${i}][property]`, c.property);
    params.append(`conditions[${i}][value]`, c.value);
    params.append(`conditions[${i}][operator]`, c.operator);
  });
  params.append("limit", String(limit));

  const url = new URL(`${datasetId}/0`, `${CMS_QUERY_BASE}/`); // fixed path; values only via query string
  url.search = params.toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`upstream_status_${res.status}`);
    const json = (await res.json()) as { results?: unknown };
    return Array.isArray(json.results) ? (json.results as Record<string, unknown>[]) : [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch + normalize Provider Information for one CCN.
 * Throws on upstream/transport failure (caller maps to a generic 502). Returns {ok:false} for a clean
 * "no facility found" (CMS returns results:[] — HTTP 200 — for an unknown but well-formed CCN).
 */
export async function fetchProviderInfo(ccn: string): Promise<ProviderLookup> {
  if (!isValidCcn(ccn)) throw new Error("invalid_ccn"); // defensive; the route validates first

  const results = await cmsQuery(
    PROVIDER_INFO_DATASET,
    [{ property: CCN_PROPERTY, value: ccn, operator: EQ }],
    1,
  );
  if (results.length === 0) return { ok: false, reason: "not_found" };

  // Read fields by LITERAL key only — never spread/iterate upstream keys (prototype-pollution guard).
  const row = results[0];
  const address = str(row.provider_address);
  const city = str(row.citytown);
  const state = str(row.state);
  const zip = str(row.zip_code);

  const data: ProviderInfo = {
    ccn,
    name: str(row.provider_name) ?? "Unknown facility",
    address,
    city,
    state,
    zip,
    location: composeLocation(address, city, state, zip),
    certifiedBeds: num(row.number_of_certified_beds),
    ratings: {
      overall: rating(row.overall_rating),
      healthInspection: rating(row.health_inspection_rating),
      staffing: rating(row.staffing_rating),
      qualityOfResidentCare: rating(row.qm_rating),
    },
    averageResidentsPerDay: num(row.average_number_of_residents_per_day),
    processingDate: str(row.processing_date),
  };
  return { ok: true, data };
}

// ---------------- Bonus: claims-based hospitalization / ED metrics ----------------

export interface FacilityResponse extends ProviderInfo {
  metrics: FacilityMetrics | null;
}

type ClaimsByCode = Partial<Record<MetricCode, { value: number | null; footnote: string | null }>>;
type AvgByCode = Partial<Record<MetricCode, number | null>>;

/** Facility's 4 claims measures (risk-adjusted score + suppression footnote), keyed by measure_code. */
async function fetchClaims(ccn: string): Promise<ClaimsByCode> {
  const rows = await cmsQuery(CLAIMS_DATASET, [{ property: CCN_PROPERTY, value: ccn, operator: EQ }], 10);
  const out: ClaimsByCode = {};
  for (const row of rows) {
    const code = str(row.measure_code) as MetricCode | null;
    if (code && (METRIC_CODES as string[]).includes(code)) {
      out[code] = { value: num(row.adjusted_score), footnote: str(row.footnote_for_score) };
    }
  }
  return out;
}

/** National (NATION row) + the facility's state row from State US Averages, by measure code. */
async function fetchStateAverages(state: string): Promise<{ national: AvgByCode; state: AvgByCode }> {
  const rows = await cmsQuery(STATE_AVG_DATASET, [], 60); // small table (~54 rows): fetch once, pick two
  const pick = (sel: string): AvgByCode => {
    const r = rows.find((x) => str(x[STATE_PROPERTY])?.toUpperCase() === sel);
    const vals: AvgByCode = {};
    if (r) for (const code of METRIC_CODES) vals[code] = num(r[AVG_COLUMN[code]]); // missing column -> null
    return vals;
  };
  return { national: pick("NATION"), state: pick(state.toUpperCase()) };
}

/**
 * Assemble the 12 metrics. BONUS — wrapped so a failure never blocks the MVP response. Uses allSettled so a
 * missing/slow claims OR averages dataset degrades gracefully (the other still renders).
 */
export async function fetchFacilityMetrics(ccn: string, state: string | null): Promise<FacilityMetrics | null> {
  const [claimsR, avgR] = await Promise.allSettled([
    fetchClaims(ccn),
    state ? fetchStateAverages(state) : Promise.resolve(null),
  ]);
  const claims = claimsR.status === "fulfilled" ? claimsR.value : null;
  const avgs = avgR.status === "fulfilled" ? avgR.value : null;
  if (!claims && !avgs) return null;

  const values = {} as Record<MetricCode, MetricValues>;
  for (const code of METRIC_CODES) {
    values[code] = {
      facility: claims?.[code]?.value ?? null,
      national: avgs?.national?.[code] ?? null,
      state: avgs?.state?.[code] ?? null,
      footnote: claims?.[code]?.footnote ?? null,
    };
  }
  return { stateCode: state, values };
}
