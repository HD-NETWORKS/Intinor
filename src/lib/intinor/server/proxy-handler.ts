import "server-only";

/**
 * Shared body for the unit proxy, parameterized by unitId so a single-unit
 * mount (/api/unit/...) and the multi-unit mount (/api/units/{id}/...) are
 * exactly the same logic — no per-unit special-casing to keep in sync.
 *
 * Browser → GET/PUT/POST/DELETE → this handler →
 * https://<host>/api/v1/units/<id>/<path> with server-held session
 * credentials. The unit password and session id never reach the client.
 *
 * Safety: guard.ts blocks destructive endpoints unconditionally and blocks
 * all writes unless explicitly enabled. With MOCK=1, requests are served from
 * src/lib/intinor/mock/ instead, regardless of unitId.
 *
 * ETag / If-None-Match is forwarded both ways so client-side polling (see
 * src/hooks/usePolledResource.ts) gets real 304s instead of re-downloading
 * unchanged status JSON every interval.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRequest } from "./guard";
import { isMockMode } from "./config";
import { resolveMock } from "../mock/resolve";
import { unitFetch } from "./unit-fetch";

export async function handleUnitProxy(
  req: NextRequest,
  unitId: string,
  pathParts: string[],
): Promise<Response> {
  const unitPath = pathParts.join("/");
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
    upstream = await unitFetch(unitId, unitPath, {
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
