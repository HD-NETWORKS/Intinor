/**
 * Next.js "Proxy" (formerly Middleware — see node_modules/next/dist/docs/
 * 01-app/03-api-reference/03-file-conventions/proxy.md). Runs on the Node.js
 * runtime in front of every request and is this dashboard's own login gate —
 * on top of, not instead of, the Intinor unit's own credentials, which stay
 * server-side and never functioned as a login for this app in the first
 * place. Without this, anyone with the Vercel URL got the whole dashboard.
 *
 * Fails closed: if DASHBOARD_USERNAME/PASSWORD/AUTH_SECRET aren't all set,
 * every request is refused (500) rather than silently left open — the same
 * posture as CRON_SECRET and the write-gates in server/guard.ts.
 * DASHBOARD_AUTH_DISABLED=1 is the explicit, documented opt-out for local
 * dev only.
 */

import { NextRequest, NextResponse } from "next/server";
import { authCredentials, authDisabled } from "@/lib/auth/config";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";

/** Reachable without a dashboard session — none of these expose secrets or writes. */
const PUBLIC_PATHS = new Set(["/login"]);

function isPublicApi(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/meta" ||
    // External scheduler auth (CRON_SECRET), not a browser session — must
    // stay reachable without one. See app/api/cron/poll/route.ts.
    pathname === "/api/cron/poll"
  );
}

export default function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (authDisabled()) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname) || isPublicApi(pathname)) {
    return NextResponse.next();
  }

  if (!authCredentials()) {
    return NextResponse.json(
      {
        title: "Dashboard auth not configured",
        status: 500,
        message:
          "Set DASHBOARD_USERNAME, DASHBOARD_PASSWORD and AUTH_SECRET (see .env.example) " +
          "before deploying, or set DASHBOARD_AUTH_DISABLED=1 for local-only development.",
      },
      { status: 500 },
    );
  }

  if (verifySessionCookieValue(req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { title: "Unauthorized", status: 401, message: "Log in to the dashboard first." },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", req.nextUrl);
  loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
