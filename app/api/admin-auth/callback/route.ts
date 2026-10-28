import { NextRequest, NextResponse } from "next/server";
import { appUrl, HC_AUTH_ME_URL, HC_AUTH_TOKEN_URL, hcaFullName, type HcaIdentity } from "@/lib/hc-auth";
import {
  ADMIN_REAUTH_COOKIE,
  ADMIN_REAUTH_FLOW_COOKIE,
  ADMIN_REAUTH_MAX_AGE,
  ADMIN_REAUTH_RETURN_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_STATE_COOKIE,
  createAdminReauthCookie,
  createAdminSessionCookie,
  getStaffAccess,
  verifyAdminSessionCookie,
} from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { limitByIp } from "@/lib/rate-limit";
import { safeAdminReturnTo } from "@/lib/security/return-to";
import { isStaff } from "@/lib/security/roles";
import { fetchSlackProfile } from "@/lib/slack";
import { getProfile } from "@/lib/profiles";

function deny(message: string, status: number) {
  const response = new NextResponse(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
  response.cookies.delete(ADMIN_STATE_COOKIE);
  response.cookies.delete(ADMIN_REAUTH_FLOW_COOKIE);
  response.cookies.delete(ADMIN_REAUTH_RETURN_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const limited = await limitByIp(request, "admin-callback", 20, 60);
  if (limited) {
    return limited;
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(ADMIN_STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return deny("Admin login failed: invalid state. Try again.", 400);
  }

  const clientId = process.env.HC_AUTH_CLIENT_ID;
  const clientSecret = process.env.HC_AUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return deny("Admin Hack Club Auth is not configured.", 500);
  }

  const redirectUri =
    process.env.ADMIN_HC_AUTH_REDIRECT_URI ??
    appUrl("/api/admin-auth/callback", request).toString();

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

  if (!identity || !slackId || !isStaff(await getStaffAccess(slackId))) {
    if (slackId) {
      await writeAudit({ actor: slackId, action: "admin.login_denied" });
    }
    return deny("You're not a Wonders admin.", 403);
  }

  const reauthFlow = request.cookies.get(ADMIN_REAUTH_FLOW_COOKIE)?.value === "1";
  const existing = verifyAdminSessionCookie(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (reauthFlow && existing && existing.slackId !== slackId) {
    await writeAudit({
      actor: slackId,
      action: "admin.reauth_wrong_account",
      detail: { expected: existing.slackId },
      sensitive: true,
    });
    return deny("That's a different account from the one you're signed in with.", 403);
  }

  await writeAudit({
    actor: slackId,
    action: reauthFlow ? "admin.reauth" : "admin.login",
  });

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

  const returnTo = reauthFlow
    ? safeAdminReturnTo(request.cookies.get(ADMIN_REAUTH_RETURN_COOKIE)?.value)
    : "/admin";
  const response = NextResponse.redirect(appUrl(returnTo, request));
  response.cookies.set(ADMIN_SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: session.maxAge,
    path: "/",
  });
  if (reauthFlow) {
    response.cookies.set(ADMIN_REAUTH_COOKIE, createAdminReauthCookie(slackId), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: ADMIN_REAUTH_MAX_AGE,
      path: "/",
    });
  }
  response.cookies.delete(ADMIN_STATE_COOKIE);
  response.cookies.delete(ADMIN_REAUTH_FLOW_COOKIE);
  response.cookies.delete(ADMIN_REAUTH_RETURN_COOKIE);
  return response;
}
