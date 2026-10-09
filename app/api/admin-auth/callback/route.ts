import { NextRequest, NextResponse } from "next/server";
import { HC_AUTH_ME_URL, HC_AUTH_TOKEN_URL, hcaFullName, type HcaIdentity } from "@/lib/hc-auth";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_STATE_COOKIE,
  createAdminSessionCookie,
  isAdminSlackId,
} from "@/lib/admin";
import { fetchSlackProfile } from "@/lib/slack";
import { getProfile } from "@/lib/profiles";

function deny(message: string, status: number) {
  const response = new NextResponse(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
  response.cookies.delete(ADMIN_STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(ADMIN_STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return deny("Admin login failed: invalid state. Try again.", 400);
  }

  const clientId = process.env.ADMIN_HC_AUTH_CLIENT_ID;
  const clientSecret = process.env.ADMIN_HC_AUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return deny("Admin Hack Club Auth is not configured.", 500);
  }

  const redirectUri =
    process.env.ADMIN_HC_AUTH_REDIRECT_URI ??
    new URL("/api/admin-auth/callback", request.url).toString();

  const tokenRes = await fetch(HC_AUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    return deny("Admin login failed: Hack Club Auth rejected the code.", 502);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    return deny("Admin login failed: no access token.", 502);
  }

  const meRes = await fetch(HC_AUTH_ME_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!meRes.ok) {
    return deny("Admin login failed: couldn't fetch your identity.", 502);
  }

  const meData = (await meRes.json()) as { identity?: HcaIdentity };
  const identity = meData.identity;
  const slackId = identity?.slack_id ?? "";

  if (!identity || !slackId || !isAdminSlackId(slackId)) {
    return deny("You're not a Wonders admin.", 403);
  }

  let name = hcaFullName(identity);
  if (!name) {
    const profile = await getProfile(slackId);
    if (profile?.name) {
      name = profile.name;
    }
  }
  if (!name) {
    const slackProfile = await fetchSlackProfile(slackId);
    if (slackProfile.displayName) {
      name = slackProfile.displayName;
    }
  }

  const session = createAdminSessionCookie({
    slackId,
    name,
    email: identity.primary_email ?? "",
  });

  const response = NextResponse.redirect(new URL("/admin", request.url));
  response.cookies.set(ADMIN_SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: session.maxAge,
    path: "/",
  });
  response.cookies.delete(ADMIN_STATE_COOKIE);
  return response;
}
