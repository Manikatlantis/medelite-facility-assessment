import { BRAND_LINE, REPORT_TITLE } from "@/lib/branding";

/**
 * The corporate banner. Renders ONLY the static brand line, the report title, and the dynamic STATE code.
 * It deliberately does NOT accept a facility-name prop — there is structurally no way for the facility name
 * to reach the header. (CLAUDE.md §4 branding guardrail.)
 */
export function BrandHeader({ state }: { state?: string | null }) {
  return (
    <header className="brand" data-testid="brand-header">
      <div className="brand-line" data-testid="brand-line">
        {BRAND_LINE}
      </div>
      <div className="brand-title">{REPORT_TITLE}</div>
      <div className="brand-state" data-testid="brand-state">
        {state ? state : " "}
      </div>
    </header>
  );
}
