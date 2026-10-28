import { NextRequest, NextResponse } from "next/server";
import {
  appUrl,
  HC_AUTH_ME_URL,
  HC_AUTH_TOKEN_URL,
  STATE_COOKIE,
  RETRY_COOKIE,
  SESSION_COOKIE,
  createSessionCookie,
  hcaFullName,
  type HcaIdentity,
} from "@/lib/hc-auth";
import { syncHcaIdentity } from "@/lib/profiles";
import { fetchSlackProfile, inviteToChannel } from "@/lib/slack";
import { limitByIp } from "@/lib/rate-limit";
import { getActiveBan } from "@/lib/bans";

export async function GET(request: NextRequest) {
  const limited = await limitByIp(request, "hc-callback", 30, 60);
  if (limited) {
    return limited;
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  if (code && state && !expectedState && !request.cookies.get(RETRY_COOKIE)) {
    const retry = NextResponse.redirect(appUrl("/api/hc-auth/login", request));
    retry.cookies.set(RETRY_COOKIE, "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });
    return retry;
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    const failed = NextResponse.redirect(appUrl("/login?error=state", request));
    failed.cookies.delete(STATE_COOKIE);
    failed.cookies.delete(RETRY_COOKIE);
    return failed;
  }

  const clientId = process.env.HC_AUTH_CLIENT_ID;
  const clientSecret = process.env.HC_AUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "HC auth is not configured" },
      { status: 500 },
    );
  }

  const redirectUri =
    process.env.HC_AUTH_REDIRECT_URI ??
    appUrl("/api/hc-auth/callback", request).toString();

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
    return NextResponse.redirect(
      appUrl("/login?error=token", request),
    );
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    return NextResponse.redirect(
      appUrl("/login?error=token", request),
    );
  }

  const meRes = await fetch(HC_AUTH_ME_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!meRes.ok) {
    return NextResponse.redirect(
      appUrl("/login?error=profile", request),
    );
  }

  const meData = (await meRes.json()) as { identity?: HcaIdentity };
  const identity = meData.identity;
  const email = identity?.primary_email;
  const slackId = identity?.slack_id ?? "";

  if (!identity || !email) {
    return NextResponse.redirect(
      appUrl("/login?error=profile", request),
    );
  }
  if (identity.verification_status === "ineligible" && identity.fatal_rejection === true) {
    const rejected = NextResponse.redirect(appUrl("/login?error=rejected", request));
    rejected.cookies.delete(SESSION_COOKIE);
    rejected.cookies.delete(STATE_COOKIE);
    return rejected;
  }

  if (slackId && (await getActiveBan(slackId))) {
    const banned = NextResponse.redirect(appUrl("/login?error=banned", request));
    banned.cookies.delete(SESSION_COOKIE);
    banned.cookies.delete(STATE_COOKIE);
    return banned;
  }

  const name = hcaFullName(identity);

  try {
    await syncHcaIdentity(identity, await fetchSlackProfile(slackId));
  } catch (err) {
    console.error("Failed to sync HCA identity:", err);
    return NextResponse.redirect(
      appUrl("/login?error=profile", request),
    );
  }

  const session = createSessionCookie({ email, name, slackId });

  if (slackId) {
    inviteToChannel(slackId).catch((err) =>
      console.error("Failed to invite user to Slack channel:", err),
    );
  }

  const response = NextResponse.redirect(appUrl("/dashboard", request));
  response.cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: session.maxAge,
    path: "/",
  });
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(RETRY_COOKIE);
  return response;
}
