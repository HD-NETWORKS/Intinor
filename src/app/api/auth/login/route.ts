import { NextRequest, NextResponse } from "next/server";
import { isAuthConfigured } from "@/lib/auth/config";
import {
  createSessionCookieValue,
  sessionMaxAgeSeconds,
  SESSION_COOKIE_NAME,
  verifyCredentials,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

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
    return NextResponse.json(
      { title: "Invalid credentials", status: 401, message: "Wrong username or password." },
      { status: 401 },
    );
  }

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
