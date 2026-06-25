/**
 * Claims-based hospitalization / ED metrics (CLAUDE.md §2 bonus). Pure + client-safe.
 *
 * 4 facility measures × {facility, national avg, state avg} = the 12 snapshot lines.
 * Map by stable measure_code, NOT label strings. CRITICAL unit rule:
 *   521 / 522 = PERCENT, 551 / 552 = RATE per 1,000 long-stay resident days (never a %).
 */
export type MetricCode = "521" | "522" | "551" | "552";
export type MetricUnit = "percent" | "per1000";
export type Which = "facility" | "national" | "state";

export interface MetricValues {
  facility: number | null;
  national: number | null;
  state: number | null;
  footnote: string | null; // present when the facility score is suppressed
}

export interface FacilityMetrics {
  stateCode: string | null;
  values: Record<MetricCode, MetricValues>;
}

export const METRIC_CODES: MetricCode[] = ["521", "522", "551", "552"];

export const METRIC_UNIT: Record<MetricCode, MetricUnit> = {
  "521": "percent",
  "522": "percent",
  "551": "per1000",
  "552": "per1000",
};

/** Exact (verified) State-US-Averages column for each measure. Two are hash-suffixed and unguessable. */
export const AVG_COLUMN: Record<MetricCode, string> = {
  "521": "percentage_of_short_stay_residents_who_were_rehospitalized__1d02",
  "522": "percentage_of_short_stay_residents_who_had_an_outpatient_em_d911",
  "551": "number_of_hospitalizations_per_1000_longstay_resident_days",
  "552": "number_of_outpatient_emergency_department_visits_per_1000_l_de9d",
};

/** The 12 report lines, in snapshot order, using the brief's CLEAN labels (state vs national separated). */
export const METRIC_ROWS: { code: MetricCode; which: Which; label: string }[] = [
  { code: "521", which: "facility", label: "Short Term Hospitalization" },
  { code: "521", which: "national", label: "STR National Avg. for Hospitalization" },
  { code: "521", which: "state", label: "STR State Avg. for Hospitalization" },
  { code: "522", which: "facility", label: "STR ED Visit" },
  { code: "522", which: "national", label: "STR ED Visits National Avg." },
  { code: "522", which: "state", label: "STR ED Visits State Avg." },
  { code: "551", which: "facility", label: "LT Hospitalization" },
  { code: "551", which: "national", label: "LT National Avg. for Hospitalization" },
  { code: "551", which: "state", label: "LT State Avg. for Hospitalization" },
  { code: "552", which: "facility", label: "LT ED Visit" },
  { code: "552", which: "national", label: "LT ED Visits National Avg." },
  { code: "552", which: "state", label: "LT ED Visits State Avg." },
];

/** Format a metric value by unit. percent → 1 decimal + "%"; per1000 → 2 decimals (no %). null → "N/A". */
export function formatMetric(v: number | null, unit: MetricUnit): string {
  if (v == null) return "N/A";
  return unit === "percent" ? `${v.toFixed(1)}%` : v.toFixed(2);
}

export function metricCell(metrics: FacilityMetrics, code: MetricCode, which: Which): string {
  return formatMetric(metrics.values[code][which], METRIC_UNIT[code]);
}
