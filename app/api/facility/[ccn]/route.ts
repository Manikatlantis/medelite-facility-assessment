import { NextResponse } from "next/server";
import { isValidCcn, fetchProviderInfo, fetchFacilityMetrics } from "@/lib/cms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // caching is controlled explicitly per-response below

type Cache = "long" | "no-store";

function reply(body: unknown, status: number, cache: Cache) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Long edge cache ONLY on a successful, populated lookup (CMS refreshes ~monthly).
      // Errors / not-found / empty are no-store so we never POISON a CCN key with a bad result.
      "Cache-Control":
        cache === "long"
          ? "public, s-maxage=86400, stale-while-revalidate=604800"
          : "no-store",
    },
  });
}

/**
 * GET /api/facility/[ccn] — the server-side proxy + data engine.
 * Only GET is exported, so other methods auto-return 405.
 * `ccn` arrives already percent-decoded from the dynamic path segment (Next 15: params is async).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ccn: string }> },
) {
  const { ccn } = await ctx.params;

  // Validate BEFORE any network call — primary SSRF / injection / abuse control.
  if (!isValidCcn(ccn)) {
    return reply(
      { error: "Invalid CCN. Expected a 6-digit CMS Certification Number." },
      400,
      "no-store",
    );
  }

  try {
    const result = await fetchProviderInfo(ccn);
    if (!result.ok) {
      return reply({ error: "No facility found for that CCN." }, 404, "no-store");
    }
    // Bonus: the 12 hospitalization/ED metrics. Never let this block the MVP response.
    const metrics = await fetchFacilityMetrics(ccn, result.data.state).catch(() => null);
    return reply({ ...result.data, metrics }, 200, "long");
  } catch (err) {
    // Log details SERVER-SIDE only; never leak the upstream URL/status/stack to the client.
    console.error("[facility lookup] failed", {
      ccn,
      message: err instanceof Error ? err.message : String(err),
    });
    return reply({ error: "Unable to fetch facility data right now." }, 502, "no-store");
  }
}
