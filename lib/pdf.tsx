/**
 * Client-side PDF generation (CLAUDE.md §5 privacy keystone): the report is assembled IN THE BROWSER from
 * public CMS data + the user's manual inputs, so the confidential inputs never reach our server.
 * Uses @react-pdf/renderer, which emits REAL selectable text + a REAL clickable link annotation (verified)
 * — not an html2canvas rasterization. Built-in Helvetica only (no network font fetch).
 */
import {
  Document,
  Page,
  View,
  Text,
  Link,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { BRAND_LINE, REPORT_TITLE } from "@/lib/branding";
import type { ProviderInfo } from "@/lib/cms";

export type ManualInputs = {
  nameOverride: string;
  emr: string;
  currentCensus: string;
  patientType: string;
  previousCoverage: string;
  previousProviderPerformance: string;
  medicalCoverage: string;
};

const C = {
  ink: "#0f172a",
  brand: "#312e81",
  line: "#cbd5e1",
  rule: "#e2e8f0",
  soft: "#f1f5f9",
  muted: "#64748b",
  link: "#1d4ed8",
};

const styles = StyleSheet.create({
  page: { paddingVertical: 34, paddingHorizontal: 38, fontFamily: "Helvetica", color: C.ink, fontSize: 9 },
  banner: { textAlign: "center", marginBottom: 18 },
  brandLine: { fontSize: 17, fontFamily: "Helvetica-Bold", color: C.brand, letterSpacing: 0.5 },
  title: { fontSize: 10, fontFamily: "Helvetica-Bold", letterSpacing: 2, marginTop: 6, color: C.ink },
  state: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 3, color: C.muted },
  table: { borderWidth: 1, borderColor: C.line, borderRadius: 2 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.rule },
  rowLast: { flexDirection: "row" },
  kCell: { width: "42%", paddingVertical: 6, paddingHorizontal: 9, backgroundColor: C.soft, fontFamily: "Helvetica-Bold", fontSize: 8.5, borderRightWidth: 1, borderRightColor: C.rule },
  vCell: { width: "58%", paddingVertical: 6, paddingHorizontal: 9, fontSize: 9 },
  muted: { color: C.muted },
  footer: { marginTop: 16 },
  link: { color: C.link, fontSize: 9, textDecoration: "underline" },
  asof: { fontSize: 7.5, color: C.muted, marginTop: 8 },
});

function ratingText(v: number | null): string {
  return v == null ? "Not Rated" : `${v} / 5`;
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  const empty = v === "" || v === "—";
  return (
    <View style={last ? styles.rowLast : styles.row}>
      <Text style={styles.kCell}>{k}</Text>
      <Text style={empty ? [styles.vCell, styles.muted] : styles.vCell}>{empty ? "—" : v}</Text>
    </View>
  );
}

export function buildFilename(name: string, ccn: string): string {
  const safe = (name || "Facility").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  return `Facility_Assessment_${safe}_${ccn}.pdf`;
}

function SnapshotDocument({ data, manual }: { data: ProviderInfo; manual: ManualInputs }) {
  const bodyName = manual.nameOverride.trim() || data.name; // override wins — BODY ONLY
  const medicareUrl = `https://www.medicare.gov/care-compare/details/nursing-home/${data.ccn}`;
  return (
    <Document title={`Facility Assessment Snapshot — ${bodyName}`} author="INFINITE — Managed by MEDELITE">
      <Page size="A4" style={styles.page}>
        {/* Banner — INFINITE is fixed; only the state is dynamic. Never the facility name. */}
        <View style={styles.banner}>
          <Text style={styles.brandLine}>{BRAND_LINE}</Text>
          <Text style={styles.title}>{REPORT_TITLE}</Text>
          <Text style={styles.state}>{data.state ?? " "}</Text>
        </View>

        <View style={styles.table}>
          <Row k="Name of Facility" v={bodyName} />
          <Row k="Location" v={data.location} />
          <Row k="EMR" v={manual.emr} />
          <Row k="Census Capacity" v={data.certifiedBeds != null ? String(data.certifiedBeds) : "—"} />
          <Row k="Current Census" v={manual.currentCensus} />
          <Row k="Type of Patient" v={manual.patientType} />
          <Row k="Previous Coverage from Medelite" v={manual.previousCoverage} />
          <Row k="Previous Provider Performance from Medelite" v={manual.previousProviderPerformance} />
          <Row k="Medical Coverage" v={manual.medicalCoverage} />
          <Row k="Overall Star Rating" v={ratingText(data.ratings.overall)} />
          <Row k="Health Inspection" v={ratingText(data.ratings.healthInspection)} />
          <Row k="Staffing" v={ratingText(data.ratings.staffing)} />
          <Row k="Quality of Resident Care" v={ratingText(data.ratings.qualityOfResidentCare)} last />
        </View>

        <View style={styles.footer}>
          <Link style={styles.link} src={medicareUrl}>
            View this facility&#39;s official profile on Medicare Care Compare
          </Link>
          {data.processingDate ? (
            <Text style={styles.asof}>
              Source: CMS Provider Data Catalog, data as of {data.processingDate}. Star ratings and figures
              reflect the live CMS refresh and may differ from older samples.
            </Text>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

export async function generatePdfBlob(args: { data: ProviderInfo; manual: ManualInputs }): Promise<Blob> {
  return pdf(<SnapshotDocument data={args.data} manual={args.manual} />).toBlob();
}
