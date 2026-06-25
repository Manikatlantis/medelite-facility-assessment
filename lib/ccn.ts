/**
 * CCN validation — pure, dependency-free, safe to import on client OR server.
 *
 * CMS nursing-home CCNs are 6 digits. (CCN is Text(6) in the data dictionary and CAN contain letters for
 * some provider types; relax to /^[0-9A-Z]{6}$/i ONLY if a non-numeric nursing-home CCN is ever observed —
 * documented, not assumed.) On the server this single check structurally blocks SSRF/path-escape and query
 * injection (no `= & [ ] / : .` possible). On the client it gives instant feedback before a wasted request.
 */
export const CCN_REGEX = /^[0-9]{6}$/;

export function isValidCcn(ccn: unknown): ccn is string {
  return typeof ccn === "string" && CCN_REGEX.test(ccn);
}
