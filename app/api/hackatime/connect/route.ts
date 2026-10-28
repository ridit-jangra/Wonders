import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { appUrl, SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  HACKATIME_AUTHORIZE_URL,
  HACKATIME_SCOPE,
  HACKATIME_STATE_COOKIE,
} from "@/lib/hackatime";

export async function GET(request: NextRequest) {
  const session = verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  const limit = await checkRateLimit("hackatime-connect", session.slackId, 20, 60);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter);
  }

  const clientId = process.env.HACKATIME_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "HACKATIME_CLIENT_ID is not configured" },
      { status: 500 },
    );
  }

  const redirectUri =
    process.env.HACKATIME_REDIRECT_URI ??
    appUrl("/api/hackatime/callback", request).toString();

  const wonder = request.nextUrl.searchParams.get("wonder") ?? "";
  const state = crypto.randomBytes(16).toString("hex");

  const authorizeUrl = new URL(HACKATIME_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", HACKATIME_SCOPE);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(
    HACKATIME_STATE_COOKIE,
    /^\d+$/.test(wonder) ? `${state}.${wonder}` : state,
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    },
  );
  return response;
}
