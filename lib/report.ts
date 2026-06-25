/**
 * Shared report helpers used by BOTH exporters (PDF + DOCX) so they can never drift apart.
 * Pure + client-safe.
 */
import type { FacilityResponse } from "./cms";
import { METRIC_ROWS, metricCell } from "./metrics";

export type ManualInputs = {
  nameOverride: string;
  emr: string;
  currentCensus: string;
  patientType: string;
  previousCoverage: string;
  previousProviderPerformance: string;
  medicalCoverage: string;
};

/** Override wins — BODY ONLY. The banner never uses this. */
export function bodyNameOf(data: FacilityResponse, manual: ManualInputs): string {
  return manual.nameOverride.trim() || data.name;
}

export function medicareUrl(ccn: string): string {
  return `https://www.medicare.gov/care-compare/details/nursing-home/${ccn}`;
}

function ratingText(v: number | null): string {
  return v == null ? "Not Rated" : `${v} / 5`;
}

/** The full ordered list of [label, value] rows: 13 core rows + (when present) the 12 metric rows. */
export function buildReportRows(data: FacilityResponse, manual: ManualInputs): [string, string][] {
  return [
    ["Name of Facility", bodyNameOf(data, manual)],
    ["Location", data.location || "—"],
    ["EMR", manual.emr || "—"],
    ["Census Capacity", data.certifiedBeds != null ? String(data.certifiedBeds) : "—"],
    ["Current Census", manual.currentCensus || "—"],
    ["Type of Patient", manual.patientType || "—"],
    ["Previous Coverage from Medelite", manual.previousCoverage || "—"],
    ["Previous Provider Performance from Medelite", manual.previousProviderPerformance || "—"],
    ["Medical Coverage", manual.medicalCoverage || "—"],
    ["Overall Star Rating", ratingText(data.ratings.overall)],
    ["Health Inspection", ratingText(data.ratings.healthInspection)],
    ["Staffing", ratingText(data.ratings.staffing)],
    ["Quality of Resident Care", ratingText(data.ratings.qualityOfResidentCare)],
    ...(data.metrics
      ? METRIC_ROWS.map((m): [string, string] => [m.label, metricCell(data.metrics!, m.code, m.which)])
      : []),
  ];
}

export function buildFilename(name: string, ccn: string, ext: string): string {
  const safe = (name || "Facility").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  return `Facility_Assessment_${safe}_${ccn}.${ext}`;
}
