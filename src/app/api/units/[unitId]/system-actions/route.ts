/**
 * Danger-zone actions for a specific unit — the multi-unit counterpart of
 * /api/system-actions. Adding a unit to INTINOR_UNITS makes this reachable
 * for it immediately, with the same two-gate safety design.
 */

import { NextRequest, NextResponse } from "next/server";
import { listUnitIds } from "@/lib/intinor/server/config";
import { performSystemAction } from "@/lib/intinor/server/system-actions";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ unitId: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { unitId } = await ctx.params;
  if (!listUnitIds().includes(unitId)) {
    return NextResponse.json(
      { title: "Unknown unit", status: 404, message: `Unit '${unitId}' is not configured.` },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const confirm = body?.confirm;
  if (typeof action !== "string" || typeof confirm !== "string") {
    return NextResponse.json(
      { title: "Bad request", status: 400, message: "Body must include 'action' and 'confirm'." },
      { status: 400 },
    );
  }

  const version = typeof body?.version === "string" ? body.version : undefined;
  const source = typeof body?.source === "string" ? body.source : undefined;

  const result = await performSystemAction(unitId, action, confirm, { version, source });
  return NextResponse.json(result.body, { status: result.status });
}
