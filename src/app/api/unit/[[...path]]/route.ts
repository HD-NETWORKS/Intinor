/**
 * Proxy for the *default* configured unit. Kept at this path so existing
 * clients (intinorClient, mounted at /api/unit) need no changes. A second
 * unit is reached at /api/units/{id}/... (see the sibling route) — same
 * handler, parameterized instead of hardcoded.
 */

import { NextRequest, NextResponse } from "next/server";
import { defaultUnitId } from "@/lib/intinor/server/config";
import { handleUnitProxy } from "@/lib/intinor/server/proxy-handler";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path?: string[] }> };

async function handle(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { path } = await ctx.params;

  let unitId: string;
  try {
    unitId = defaultUnitId();
  } catch (err) {
    return NextResponse.json(
      {
        title: "Not configured",
        status: 500,
        message: err instanceof Error ? err.message : "No unit configured",
      },
      { status: 500 },
    );
  }

  return handleUnitProxy(req, unitId, path ?? []);
}

export { handle as GET, handle as PUT, handle as POST, handle as DELETE };
