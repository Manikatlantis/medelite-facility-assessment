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

const CMS_QUERY_BASE = "https://data.cms.gov/provider-data/api/1/datastore/query";
const PROVIDER_INFO_DATASET = "4pq5-n9py"; // verified live
const CCN_PROPERTY = "cms_certification_number_ccn";
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
 * Fetch + normalize Provider Information for one CCN.
 * Throws on upstream/transport failure (caller maps to a generic 502). Returns {ok:false} for a clean
 * "no facility found" (CMS returns results:[] — HTTP 200 — for an unknown but well-formed CCN).
 */
export async function fetchProviderInfo(ccn: string): Promise<ProviderLookup> {
  if (!isValidCcn(ccn)) throw new Error("invalid_ccn"); // defensive; the route validates first

  // Build the request with URLSearchParams so the value is encoded by the serializer, not hand-concatenated.
  const params = new URLSearchParams();
  params.append("conditions[0][property]", CCN_PROPERTY);
  params.append("conditions[0][value]", ccn); // the ONLY dynamic value
  params.append("conditions[0][operator]", EQ);
  params.append("limit", "1");

  const url = new URL(`${PROVIDER_INFO_DATASET}/0`, `${CMS_QUERY_BASE}/`); // fixed path; CCN never enters it
  url.search = params.toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  let json: unknown;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`upstream_status_${res.status}`);
    json = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const results =
    json && typeof json === "object" && Array.isArray((json as { results?: unknown }).results)
      ? ((json as { results: unknown[] }).results as unknown[])
      : [];
  if (results.length === 0) return { ok: false, reason: "not_found" };

  // Read fields by LITERAL key only — never spread/iterate upstream keys (prototype-pollution guard).
  const row = results[0] as Record<string, unknown>;
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
