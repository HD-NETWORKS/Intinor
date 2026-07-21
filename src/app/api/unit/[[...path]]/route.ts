/**
 * Proxy for the Intinor unit's REST API.
 *
 * Browser → GET/PUT/POST/DELETE /api/unit/<unit-relative-path> → this route →
 * https://<unit>/api/v1/units/<id>/<path> with server-held session credentials.
 * The unit password and session id never reach the client.
 *
 * Safety: src/lib/intinor/server/guard.ts blocks destructive endpoints
 * unconditionally and blocks all writes unless explicitly enabled.
 * With MOCK=1, requests are served from src/lib/intinor/mock/ instead.
 *
 * ETag / If-None-Match is forwarded both ways so client-side polling (see
 * src/hooks/usePolledResource.ts) gets real 304s instead of re-downloading
 * unchanged status JSON every interval.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRequest } from "@/lib/intinor/server/guard";
import { isMockMode } from "@/lib/intinor/server/config";
import { resolveMock } from "@/lib/intinor/mock/resolve";
import { unitFetch } from "@/lib/intinor/server/unit-fetch";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path?: string[] }> };

async function handle(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { path } = await ctx.params;
  const unitPath = (path ?? []).join("/");
  const method = req.method.toUpperCase();

  const guard = checkRequest(method, unitPath);
  if (!guard.allowed) {
    return NextResponse.json(
      { title: "Blocked by proxy", status: guard.status, message: guard.reason },
      { status: guard.status },
    );
  }

  const hasBody = method === "PUT" || method === "POST";
  const rawBody = hasBody ? await req.text() : undefined;
  const ifNoneMatch = req.headers.get("if-none-match") ?? undefined;

  if (isMockMode()) {
    let parsedBody: unknown;
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = rawBody;
      }
    }
    const mock = resolveMock(method, unitPath, parsedBody, ifNoneMatch, req.nextUrl.searchParams);

    const headers = new Headers({ "X-Intinor-Mock": "1" });
    if (mock.etag) headers.set("ETag", mock.etag);

    if (mock.status === 304) {
      return new Response(null, { status: 304, headers });
    }
    if (mock.contentType) {
      headers.set("Content-Type", mock.contentType);
      return new Response(mock.body as string, { status: mock.status, headers });
    }
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(mock.body), { status: mock.status, headers });
  }

  let upstream: Response;
  try {
    upstream = await unitFetch(unitPath, {
      method,
      body: rawBody,
      contentType: req.headers.get("content-type") ?? undefined,
      search: req.nextUrl.search,
      ifNoneMatch,
    });
  } catch (err) {
    return NextResponse.json(
      {
        title: "Unit unreachable",
        status: 502,
        message: err instanceof Error ? err.message : "Failed to reach the unit",
      },
      { status: 502 },
    );
  }

  // Pass the upstream response through, preserving content type (JSON,
  // thumbnail images, config XML …) but not hop-by-hop/auth headers.
  const headers = new Headers();
  for (const name of ["content-type", "etag", "cache-control"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (upstream.status === 304) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

export { handle as GET, handle as PUT, handle as POST, handle as DELETE };
