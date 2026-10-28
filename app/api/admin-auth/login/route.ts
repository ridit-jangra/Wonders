import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { appUrl, HC_AUTH_AUTHORIZE_URL } from "@/lib/hc-auth";
import {
  ADMIN_HC_AUTH_SCOPE,
  ADMIN_REAUTH_FLOW_COOKIE,
  ADMIN_REAUTH_MAX_AGE,
  ADMIN_REAUTH_RETURN_COOKIE,
  ADMIN_STATE_COOKIE,
} from "@/lib/admin";
import { limitByIp } from "@/lib/rate-limit";
import { safeAdminReturnTo } from "@/lib/security/return-to";

export async function GET(request: NextRequest) {
  const limited = await limitByIp(request, "admin-login", 20, 60);
  if (limited) {
    return limited;
  }

  const reauth = request.nextUrl.searchParams.get("reauth") === "1";
  const clientId = process.env.HC_AUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "HC_AUTH_CLIENT_ID is not configured" },
      { status: 500 },
    );
  }

  const redirectUri =
    process.env.ADMIN_HC_AUTH_REDIRECT_URI ??
    appUrl("/api/admin-auth/callback", request).toString();

  const state = crypto.randomBytes(16).toString("hex");

  const authorizeUrl = new URL(HC_AUTH_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", ADMIN_HC_AUTH_SCOPE);
  authorizeUrl.searchParams.set("state", state);
  if (reauth) {
    authorizeUrl.searchParams.set("prompt", "login");
  }

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(ADMIN_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  if (reauth) {
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      maxAge: ADMIN_REAUTH_MAX_AGE,
      path: "/",
    };
    response.cookies.set(ADMIN_REAUTH_FLOW_COOKIE, "1", cookieOptions);
    response.cookies.set(
      ADMIN_REAUTH_RETURN_COOKIE,
      safeAdminReturnTo(request.nextUrl.searchParams.get("return_to")),
      cookieOptions,
    );
  } else {
    response.cookies.delete(ADMIN_REAUTH_FLOW_COOKIE);
    response.cookies.delete(ADMIN_REAUTH_RETURN_COOKIE);
  }
  return response;
}
