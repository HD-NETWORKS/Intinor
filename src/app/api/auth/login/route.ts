import { NextRequest, NextResponse } from "next/server";
import { isAuthConfigured } from "@/lib/auth/config";
import { clearLoginAttempts, isLoginRateLimited, recordFailedLogin } from "@/lib/auth/rate-limit";
import {
  createSessionCookieValue,
  sessionMaxAgeSeconds,
  SESSION_COOKIE_NAME,
  verifyCredentials,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Vercel/Cloudflare both set one of these at the edge; "unknown" is a
 *  shared fallback bucket for the rare request that has neither, not a
 *  way to bypass the limiter. */
function clientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        title: "Dashboard auth not configured",
        status: 500,
        message: "Set DASHBOARD_USERNAME, DASHBOARD_PASSWORD and AUTH_SECRET first.",
      },
      { status: 500 },
    );
  }

  const ip = clientIp(req);
  if (isLoginRateLimited(ip)) {
    return NextResponse.json(
      {
        title: "Too many attempts",
        status: 429,
        message: "Too many failed logins from this address. Try again later.",
      },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const username = body?.username;
  const password = body?.password;
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { title: "Bad request", status: 400, message: "Username and password are required." },
      { status: 400 },
    );
  }

  if (!verifyCredentials(username, password)) {
    recordFailedLogin(ip);
    return NextResponse.json(
      { title: "Invalid credentials", status: 401, message: "Wrong username or password." },
      { status: 401 },
    );
  }
  clearLoginAttempts(ip);

  const cookieValue = createSessionCookieValue();
  if (!cookieValue) {
    // Can't happen given the isAuthConfigured() check above, but keeps this
    // route honest if that ever changes.
    return NextResponse.json(
      { title: "Dashboard auth not configured", status: 500, message: "No session issued." },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAgeSeconds(),
  });
  return res;
}
