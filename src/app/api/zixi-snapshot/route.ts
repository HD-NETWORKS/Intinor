/**
 * Stream list for the /zixi monitoring page. Unlike the [streamId] push
 * route, this is a normal dashboard route — protected by the session gate in
 * proxy.ts like everything else under /api/, no separate auth here.
 */

import { NextResponse } from "next/server";
import { isConfigured, listStreams } from "@/lib/zixi/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({
      configured: false,
      streams: [],
      message:
        "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and run supabase/schema.sql.",
    });
  }

  try {
    const streams = await listStreams();
    return NextResponse.json({ configured: true, streams });
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        streams: [],
        error: err instanceof Error ? err.message : "Stream list query failed",
      },
      { status: 502 },
    );
  }
}
