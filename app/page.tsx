"use client";

import { useState } from "react";
import type { ProviderInfo } from "@/lib/cms";
import { CCN_REGEX } from "@/lib/ccn";
import { FIELD_CAPS } from "@/lib/branding";
import { BrandHeader } from "@/components/BrandHeader";

type Manual = {
  nameOverride: string;
  emr: string;
  currentCensus: string;
  patientType: string;
  previousCoverage: "" | "Yes" | "No";
  previousProviderPerformance: string;
  medicalCoverage: string;
};

const EMPTY_MANUAL: Manual = {
  nameOverride: "",
  emr: "",
  currentCensus: "",
  patientType: "",
  previousCoverage: "",
  previousProviderPerformance: "",
  medicalCoverage: "",
};

// Per-field caps enforced HERE (state setter), not only via DOM maxLength (paste can bypass that).
const CAPS: Record<keyof Manual, number> = {
  nameOverride: FIELD_CAPS.nameOverride,
  emr: FIELD_CAPS.emr,
  currentCensus: FIELD_CAPS.currentCensus,
  patientType: FIELD_CAPS.patientType,
  previousProviderPerformance: FIELD_CAPS.previousProviderPerformance,
  medicalCoverage: FIELD_CAPS.medicalCoverage,
  previousCoverage: 3, // "Yes"/"No"
};

function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="na">Not Rated</span>;
  return (
    <span>
      <span className="stars">{"★".repeat(value)}</span>
      <span className="na" style={{ marginLeft: 6, fontStyle: "normal" }}>
        {value} / 5
      </span>
    </span>
  );
}

export default function Home() {
  const [ccnInput, setCcnInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProviderInfo | null>(null);
  const [manual, setManual] = useState<Manual>(EMPTY_MANUAL);
  const [pdfBusy, setPdfBusy] = useState(false);

  function setField<K extends keyof Manual>(key: K, raw: string) {
    const capped = raw.slice(0, CAPS[key]) as Manual[K];
    setManual((m) => ({ ...m, [key]: capped }));
  }

  async function lookup() {
    const ccn = ccnInput.trim();
    setError(null);
    if (!CCN_REGEX.test(ccn)) {
      setError("Enter a valid 6-digit CCN (e.g. 686123).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/facility/${ccn}`);
      const body = await res.json();
      if (!res.ok) {
        setData(null);
        setError(body?.error ?? "Lookup failed.");
        return;
      }
      setData(body as ProviderInfo);
    } catch {
      setData(null);
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!data) return;
    setError(null);
    setPdfBusy(true);
    try {
      // Lazy-load the (heavy) PDF module only on demand; it runs 100% in the browser.
      const { generatePdfBlob, buildFilename } = await import("@/lib/pdf");
      const blob = await generatePdfBlob({ data, manual });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildFilename(manual.nameOverride.trim() || data.name, data.ccn);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setPdfBusy(false);
    }
  }

  // Name-override wins, but ONLY for the body line. The header never sees this value.
  const bodyName = manual.nameOverride.trim() || data?.name || "";

  return (
    <main className="page">
      <BrandHeader state={data?.state} />

      <div className="grid">
        {/* ---------------- INPUTS ---------------- */}
        <section className="card">
          <h2>Facility Lookup</h2>
          <div className="lookup-row">
            <div className="field">
              <label htmlFor="ccn">CCN (CMS Certification Number)</label>
              <input
                id="ccn"
                inputMode="numeric"
                placeholder="686123"
                value={ccnInput}
                maxLength={6}
                onChange={(e) => setCcnInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
              />
            </div>
            <button id="lookup" className="primary" onClick={lookup} disabled={loading}>
              {loading ? "Looking up…" : "Look up"}
            </button>
          </div>
          {error && (
            <div className="error" id="error">
              {error}
            </div>
          )}

          <div className="divider" />
          <h2>Operational Inputs (manual)</h2>
          <p className="hint">These stay in your browser — they are never sent to our server.</p>

          <div className="field">
            <label htmlFor="nameOverride">Facility name override (optional)</label>
            <input
              id="nameOverride"
              value={manual.nameOverride}
              maxLength={CAPS.nameOverride}
              placeholder={data?.name ?? "Defaults to the CMS legal name"}
              onChange={(e) => setField("nameOverride", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="emr">EMR</label>
            <input id="emr" value={manual.emr} maxLength={CAPS.emr} placeholder="PCC"
              onChange={(e) => setField("emr", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="currentCensus">Current Census</label>
            <input id="currentCensus" inputMode="numeric" value={manual.currentCensus} maxLength={CAPS.currentCensus}
              placeholder={data?.averageResidentsPerDay ? String(Math.round(data.averageResidentsPerDay)) : "112"}
              onChange={(e) => setField("currentCensus", e.target.value.replace(/[^0-9]/g, ""))} />
          </div>
          <div className="field">
            <label htmlFor="patientType">Type of Patient</label>
            <input id="patientType" value={manual.patientType} maxLength={CAPS.patientType} placeholder="Long-term & Short-term"
              onChange={(e) => setField("patientType", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="previousCoverage">Previous Coverage from Medelite</label>
            <select id="previousCoverage" value={manual.previousCoverage}
              onChange={(e) => setField("previousCoverage", e.target.value)}>
              <option value="">—</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="previousProviderPerformance">Previous Provider Performance from Medelite</label>
            <input id="previousProviderPerformance" value={manual.previousProviderPerformance}
              maxLength={CAPS.previousProviderPerformance} placeholder="About 30 patients/day"
              onChange={(e) => setField("previousProviderPerformance", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="medicalCoverage">Medical Coverage</label>
            <input id="medicalCoverage" value={manual.medicalCoverage} maxLength={CAPS.medicalCoverage}
              placeholder="Optometry, PCP, Podiatry"
              onChange={(e) => setField("medicalCoverage", e.target.value)} />
          </div>
        </section>

        {/* ---------------- PREVIEW (report body) ---------------- */}
        <section className="card">
          <div className="preview-head">
            <h2 style={{ margin: 0 }}>Report Preview</h2>
            <button id="download" className="primary" onClick={downloadPdf} disabled={!data || pdfBusy}>
              {pdfBusy ? "Generating…" : "Download PDF"}
            </button>
          </div>
          {!data && !manual.nameOverride ? (
            <div className="placeholder">Look up a CCN to populate the snapshot.</div>
          ) : (
            <div>
              <div className="row"><div className="k">Name of Facility</div><div className="v" data-testid="body-name">{bodyName || <span className="na">—</span>}</div></div>
              <div className="row"><div className="k">Location</div><div className="v" data-testid="body-location">{data?.location || <span className="na">—</span>}</div></div>
              <div className="row"><div className="k">EMR</div><div className={`v${manual.emr ? "" : " muted"}`}>{manual.emr || "—"}</div></div>
              <div className="row"><div className="k">Census Capacity</div><div className="v" data-testid="body-beds">{data?.certifiedBeds ?? <span className="na">—</span>}</div></div>
              <div className="row"><div className="k">Current Census</div><div className={`v${manual.currentCensus ? "" : " muted"}`}>{manual.currentCensus || "—"}</div></div>
              <div className="row"><div className="k">Type of Patient</div><div className={`v${manual.patientType ? "" : " muted"}`}>{manual.patientType || "—"}</div></div>
              <div className="row"><div className="k">Previous Coverage from Medelite</div><div className={`v${manual.previousCoverage ? "" : " muted"}`}>{manual.previousCoverage || "—"}</div></div>
              <div className="row"><div className="k">Previous Provider Performance</div><div className={`v${manual.previousProviderPerformance ? "" : " muted"}`}>{manual.previousProviderPerformance || "—"}</div></div>
              <div className="row"><div className="k">Medical Coverage</div><div className={`v${manual.medicalCoverage ? "" : " muted"}`}>{manual.medicalCoverage || "—"}</div></div>
              <div className="row"><div className="k">Overall Star Rating</div><div className="v"><Stars value={data?.ratings.overall ?? null} /></div></div>
              <div className="row"><div className="k">Health Inspection</div><div className="v"><Stars value={data?.ratings.healthInspection ?? null} /></div></div>
              <div className="row"><div className="k">Staffing</div><div className="v"><Stars value={data?.ratings.staffing ?? null} /></div></div>
              <div className="row"><div className="k">Quality of Resident Care</div><div className="v"><Stars value={data?.ratings.qualityOfResidentCare ?? null} /></div></div>
              {data?.processingDate && <div className="asof">CMS data as of {data.processingDate}. Values reflect the live CMS refresh and will differ from older samples.</div>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
