/**
 * Right-sized security headers (see CLAUDE.md §6).
 * CSP is intentionally added in the UI slice (Slice 2), once there is a page to protect and we can
 * verify it does not break styled-jsx / @react-pdf rendering. The headers below cost nothing and apply now.
 * HSTS is modest (1y, no preload / no includeSubDomains) because we do not control vercel.app subdomains.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
