import type { ReactNode } from "react";
import "./globals.css";

// Render per-request so Next can stamp the per-request CSP nonce (from middleware) onto its own scripts.
// A statically prerendered page has no nonce baked in, which `strict-dynamic` would then block. (CLAUDE.md §6)
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Facility Assessment Snapshot — INFINITE",
  description: "INFINITE — Managed by MEDELITE",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
