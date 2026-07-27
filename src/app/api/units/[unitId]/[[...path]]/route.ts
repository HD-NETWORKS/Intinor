/**
 * Multi-unit proxy: /api/units/{unitId}/<unit-relative-path>. Add a unit to
 * INTINOR_UNITS (see server/config.ts) and it is reachable here immediately —
 * no new route, no code change. /api/unit/... remains the shortcut for the
 * default unit and shares this same handler.
 */

import { NextRequest, NextResponse } from "next/server";
import { listUnitIds } from "@/lib/intinor/server/config";
import { handleUnitProxy } from "@/lib/intinor/server/proxy-handler";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ unitId: string; path?: string[] }> };

async function handle(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { unitId, path } = await ctx.params;

  if (!listUnitIds().includes(unitId)) {
    return NextResponse.json(
      {
        title: "Unknown unit",
        status: 404,
        message: `Unit '${unitId}' is not configured.`,
      },
      { status: 404 },
    );
  }

  return handleUnitProxy(req, unitId, path ?? []);
}

export { handle as GET, handle as PUT, handle as POST, handle as DELETE };
