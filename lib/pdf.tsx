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
  Image,
  Link,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { REPORT_TITLE } from "@/lib/branding";
import { LOGO_DATA_URI } from "@/lib/logo";
import type { FacilityResponse } from "@/lib/cms";
import { type ManualInputs, bodyNameOf, buildReportRows, medicareUrl } from "@/lib/report";

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
  banner: { marginBottom: 18, alignItems: "center" },
  lockup: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  icon: { width: 64, height: 36, marginRight: 9 },
  infinite: { fontSize: 21, fontFamily: "Helvetica-Bold", color: "#9b1fb0", letterSpacing: 1 },
  managed: { fontSize: 8.5, color: "#3f8a9d", marginTop: 1 },
  med: { color: "#6b7280", fontFamily: "Helvetica-Bold" },
  elite: { color: "#1d4ed8", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 10, fontFamily: "Helvetica-Bold", letterSpacing: 2, marginTop: 2, color: C.ink },
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

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  const empty = v === "" || v === "—";
  return (
    <View style={last ? styles.rowLast : styles.row}>
      <Text style={styles.kCell}>{k}</Text>
      <Text style={empty ? [styles.vCell, styles.muted] : styles.vCell}>{empty ? "—" : v}</Text>
    </View>
  );
}

function SnapshotDocument({ data, manual }: { data: FacilityResponse; manual: ManualInputs }) {
  const bodyName = bodyNameOf(data, manual);
  const rows = buildReportRows(data, manual);

  return (
    <Document title={`Facility Assessment Snapshot — ${bodyName}`} author="INFINITE — Managed by MEDELITE">
      <Page size="A4" style={styles.page}>
        {/* Banner — the INFINITE logo lockup is fixed; only the state is dynamic. Never the facility name. */}
        <View style={styles.banner}>
          <View style={styles.lockup}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={LOGO_DATA_URI} style={styles.icon} />
            <View>
              <Text style={styles.infinite}>INFINITE</Text>
              <Text style={styles.managed}>
                Managed by <Text style={styles.med}>MED</Text>
                <Text style={styles.elite}>ELITE</Text>
              </Text>
            </View>
          </View>
          <Text style={styles.title}>{REPORT_TITLE}</Text>
          <Text style={styles.state}>{data.state ?? " "}</Text>
        </View>

        <View style={styles.table}>
          {rows.map(([k, v], i) => (
            <Row key={k} k={k} v={v} last={i === rows.length - 1} />
          ))}
        </View>

        <View style={styles.footer}>
          <Link style={styles.link} src={medicareUrl(data.ccn)}>
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

export async function generatePdfBlob(args: { data: FacilityResponse; manual: ManualInputs }): Promise<Blob> {
  return pdf(<SnapshotDocument data={args.data} manual={args.manual} />).toBlob();
}
