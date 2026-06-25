/**
 * Client-side Word (.docx) generation (same privacy keystone as the PDF — assembled in the browser, so the
 * confidential inputs never reach our server). Uses the `docx` library: all values go through TextRun text
 * nodes (escaped by the library), so manual inputs can't inject markup/XML. Shares buildReportRows() with
 * the PDF so the two exports can't drift.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ExternalHyperlink,
  BorderStyle,
  TableLayoutType,
} from "docx";
import { BRAND_LINE, REPORT_TITLE } from "./branding";
import { type ManualInputs, bodyNameOf, buildReportRows, medicareUrl } from "./report";
import type { FacilityResponse } from "./cms";

const INK = "0F172A";
const BRAND = "312E81";
const MUTED = "64748B";
const SOFT = "F1F5F9";
const LINE = "CBD5E1";
const RULE = "E2E8F0";

// Fixed table layout with explicit column widths (twips). Percentage widths collapse in Word, so we size
// columns against the A4 usable width (page 11906 − two 1440 margins = 9026 twips). 42% / 58% split.
const USABLE = 9026;
const COL1 = Math.round(USABLE * 0.42); // label column
const COL2 = USABLE - COL1; // value column

function center(children: TextRun[], spacingAfter = 0): Paragraph {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: spacingAfter }, children });
}

function cell(text: string, opts: { bold?: boolean; fill?: string; width: number }): TableCell {
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill } : undefined,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold, size: 18, color: INK })] })],
  });
}

export async function generateDocxBlob(args: { data: FacilityResponse; manual: ManualInputs }): Promise<Blob> {
  const { data, manual } = args;
  const bodyName = bodyNameOf(data, manual);
  const rows = buildReportRows(data, manual);

  const grey = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  const inside = { style: BorderStyle.SINGLE, size: 4, color: RULE };
  const table = new Table({
    width: { size: USABLE, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [COL1, COL2],
    borders: { top: grey, bottom: grey, left: grey, right: grey, insideHorizontal: inside, insideVertical: inside },
    rows: rows.map(
      ([k, v]) =>
        new TableRow({ children: [cell(k, { bold: true, fill: SOFT, width: COL1 }), cell(v || "—", { width: COL2 })] }),
    ),
  });

  const doc = new Document({
    title: `Facility Assessment Snapshot — ${bodyName}`,
    creator: "INFINITE — Managed by MEDELITE",
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 portrait (twips)
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: [
          // Banner — INFINITE is fixed; only the state is dynamic. Never the facility name.
          center([new TextRun({ text: BRAND_LINE, bold: true, size: 32, color: BRAND })], 60),
          center([new TextRun({ text: REPORT_TITLE, bold: true, size: 20, color: INK, characterSpacing: 40 })], 40),
          center([new TextRun({ text: data.state ?? " ", bold: true, size: 20, color: MUTED })], 160),
          table,
          new Paragraph({
            spacing: { before: 220 },
            children: [
              new ExternalHyperlink({
                link: medicareUrl(data.ccn),
                children: [
                  new TextRun({ text: "View this facility's official profile on Medicare Care Compare", style: "Hyperlink" }),
                ],
              }),
            ],
          }),
          ...(data.processingDate
            ? [
                new Paragraph({
                  spacing: { before: 100 },
                  children: [
                    new TextRun({
                      text: `Source: CMS Provider Data Catalog, data as of ${data.processingDate}. Star ratings and figures reflect the live CMS refresh and may differ from older samples.`,
                      size: 14,
                      color: MUTED,
                    }),
                  ],
                }),
              ]
            : []),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
