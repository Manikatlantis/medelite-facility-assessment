"use client";

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer } from "recharts";
import type { FacilityMetrics, MetricCode } from "@/lib/metrics";
import { METRIC_UNIT, formatMetric } from "@/lib/metrics";

const CARDS: { code: MetricCode; title: string }[] = [
  { code: "521", title: "Short-Stay Hospitalization" },
  { code: "522", title: "Short-Stay ED Visit" },
  { code: "551", title: "Long-Stay Hospitalization" },
  { code: "552", title: "Long-Stay ED Visit" },
];

const NEUTRAL = "#94a3b8";
const GOOD = "#16a34a"; // facility at/below national average (lower = better for these measures)
const BAD = "#dc2626"; // facility above national average

export function MetricsCharts({ metrics }: { metrics: FacilityMetrics }) {
  return (
    <section className="card" data-testid="metrics-charts" style={{ marginTop: 20 }}>
      <h2>Metrics at a Glance</h2>
      <p className="hint">
        Hospitalization &amp; ED rates — facility vs. national and state averages. Lower is better; the
        facility bar is green when it beats the national average, red when it&#39;s worse.
      </p>
      <div className="charts-grid">
        {CARDS.map(({ code, title }) => {
          const unit = METRIC_UNIT[code];
          const mv = metrics.values[code];
          const data = [
            { name: "Facility", value: mv.facility },
            { name: "National", value: mv.national },
            { name: metrics.stateCode ?? "State", value: mv.state },
          ];
          const facilityColor =
            mv.facility != null && mv.national != null ? (mv.facility <= mv.national ? GOOD : BAD) : NEUTRAL;
          return (
            <div className="chart-card" key={code} data-testid={`chart-${code}`}>
              <div className="chart-title">{title}</div>
              <div className="chart-sub">{unit === "percent" ? "% of residents" : "per 1,000 resident-days"}</div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={data} margin={{ top: 18, right: 8, left: -16, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip
                    formatter={(v) => formatMetric(v == null ? null : Number(v), unit)}
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    <Cell fill={facilityColor} />
                    <Cell fill={NEUTRAL} />
                    <Cell fill={NEUTRAL} />
                    <LabelList
                      dataKey="value"
                      position="top"
                      formatter={(v) => (v == null ? "N/A" : formatMetric(Number(v), unit))}
                      style={{ fontSize: 9, fill: "#475569" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </section>
  );
}
