/**
 * Dashboard metadata for the UI chrome (mock banner, unit label, write mode).
 * Exposes no secrets — only mode flags and the public unit id.
 */

import { NextResponse } from "next/server";
import { isMockMode, writesAllowed } from "@/lib/intinor/server/config";

export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return NextResponse.json({
    mock: isMockMode(),
    writesAllowed: writesAllowed(),
    unitId: process.env.INTINOR_UNIT_ID ?? (isMockMode() ? "D01393 (mock)" : null),
    configured: Boolean(
      process.env.INTINOR_UNIT_HOST &&
        process.env.INTINOR_UNIT_ID &&
        process.env.INTINOR_USERNAME &&
        process.env.INTINOR_PASSWORD,
    ),
  });
}
