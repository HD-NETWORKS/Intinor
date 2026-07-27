/**
 * Dashboard metadata for the UI chrome (mock banner, unit label, write mode).
 * Exposes no secrets — only mode flags and public unit ids.
 */

import { NextResponse } from "next/server";
import {
  destructiveActionsAllowed,
  isMockMode,
  listUnitIds,
  writesAllowed,
} from "@/lib/intinor/server/config";
import { authDisabled, isAuthConfigured } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

/** Exempted from the dashboard login gate in src/proxy.ts — no secrets here. */
export function GET(): NextResponse {
  const units = listUnitIds();
  return NextResponse.json({
    mock: isMockMode(),
    writesAllowed: writesAllowed(),
    destructiveActionsAllowed: destructiveActionsAllowed() || isMockMode(),
    unitId: units[0] ?? null,
    units,
    configured: units.length > 0,
    authDisabled: authDisabled(),
    authConfigured: isAuthConfigured(),
  });
}
