import { NextResponse, type NextRequest } from "next/server";

/**
 * Content-Security-Policy via a per-request nonce (CLAUDE.md §6).
 *
 * PROD: `script-src 'self' 'nonce-…' 'strict-dynamic'` — no `unsafe-inline` on scripts, so an injected inline
 *       <script> cannot execute. Next reads the nonce from the CSP in the *request* headers and stamps its own
 *       bootstrap scripts with it. `strict-dynamic` then extends trust to the chunks those scripts load.
 * DEV:  Fast Refresh / HMR need `unsafe-eval` + `unsafe-inline`, so we relax script-src in development only.
 *
 * `style-src` keeps `unsafe-inline` (Next/inline styles) — accepted: the REAL XSS control is JSX escaping,
 * and `connect-src 'self'` + `img-src 'self'` are the exfil backstop even if a style vector were found.
 * The static headers (XFO, nosniff, etc.) live in next.config.mjs.
 */
export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV !== "production";

  // 'wasm-unsafe-eval' lets @react-pdf/renderer's WebAssembly layout engine compile (targeted — it does NOT
  // permit JS eval, and it still applies under strict-dynamic). Dev keeps 'unsafe-eval' for Fast Refresh.
  const scriptSrc = isDev
    ? "'self' 'unsafe-eval' 'unsafe-inline'"
    : `'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'`;

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // react-pdf fetches its WASM layout engine from a data: URL. data: is inline (no network egress), so
    // allowing it in connect-src cannot exfiltrate to a remote host.
    "connect-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");

  // Pass the nonce + CSP to Next via request headers so it can nonce its scripts.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export const config = {
  // Apply to everything except Next's static assets / favicon.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
    },
  ],
};
