/**
 * Danger-zone actions for the default unit. See
 * src/lib/intinor/server/system-actions.ts for the two-gate safety design —
 * this route only parses the request and resolves which unit "default"
 * means; it never talks to the unit directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { defaultUnitId } from "@/lib/intinor/server/config";
import { performSystemAction } from "@/lib/intinor/server/system-actions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const action = body?.action;
  const confirm = body?.confirm;
  if (typeof action !== "string" || typeof confirm !== "string") {
    return NextResponse.json(
      { title: "Bad request", status: 400, message: "Body must include 'action' and 'confirm'." },
      { status: 400 },
    );
  }

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

  const version = typeof body?.version === "string" ? body.version : undefined;
  const source = typeof body?.source === "string" ? body.source : undefined;

  const result = await performSystemAction(unitId, action, confirm, { version, source });
  return NextResponse.json(result.body, { status: result.status });
}
