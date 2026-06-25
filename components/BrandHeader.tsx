import { BRAND_LINE, REPORT_TITLE } from "@/lib/branding";

/**
 * The corporate banner = the INFINITE logo lockup (CLAUDE.md §4 branding guardrail). The icon (from /public)
 * sits beside the fixed "INFINITE — Managed by MEDELITE" wordmark, then the report title and the dynamic
 * STATE code. The brand is structurally fixed; the facility name can never reach the header.
 */
export function BrandHeader({ state }: { state?: string | null }) {
  return (
    <header className="brand" data-testid="brand-header">
      <div className="brand-lockup">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-icon" src="/medelite-logo.png" alt={BRAND_LINE} data-testid="brand-logo" />
        <div className="brand-words">
          <div className="brand-infinite">INFINITE</div>
          <div className="brand-managed">
            Managed by <span className="med">MED</span><span className="elite">ELITE</span>
          </div>
        </div>
      </div>
      <div className="brand-title">{REPORT_TITLE}</div>
      <div className="brand-state" data-testid="brand-state">
        {state ? state : " "}
      </div>
    </header>
  );
}
