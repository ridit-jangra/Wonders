import { NextRequest, NextResponse } from "next/server";
import { appUrl, SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import {
  fetchHackatimeSlackId,
  HACKATIME_STATE_COOKIE,
  HACKATIME_TOKEN_URL,
} from "@/lib/hackatime";
import { getProfile, setHackatimeToken } from "@/lib/profiles";

export async function GET(request: NextRequest) {
  const session = verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  const [expectedState, wonder] = (
    request.cookies.get(HACKATIME_STATE_COOKIE)?.value ?? ""
  ).split(".");
  const back = (outcome: "connected" | "failed" | "mismatch") => {
    const url = appUrl(
      wonder ? `/dashboard/projects/edit/${wonder}` : "/wonders",
      request,
    );
    url.searchParams.set("hackatime", outcome);
    const response = NextResponse.redirect(url);
    response.cookies.delete(HACKATIME_STATE_COOKIE);
    return response;
  };

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state || !expectedState || state !== expectedState) {
    return back("failed");
  }

  const clientId = process.env.HACKATIME_CLIENT_ID;
  const clientSecret = process.env.HACKATIME_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Hackatime is not configured" },
      { status: 500 },
    );
  }

  const redirectUri =
    process.env.HACKATIME_REDIRECT_URI ??
    appUrl("/api/hackatime/callback", request).toString();

  const tokenRes = await fetch(HACKATIME_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    return back("failed");
  }

  const { access_token: token } = (await tokenRes.json()) as { access_token?: string };
  if (!token) {
    return back("failed");
  }

  const tokenSlackId = await fetchHackatimeSlackId(token);
  if (!tokenSlackId || tokenSlackId !== session.slackId) {
    return back("mismatch");
  }

  const profile = await getProfile(session.slackId);
  if (!profile) {
    return NextResponse.redirect(appUrl("/onboarding", request));
  }

  await setHackatimeToken(profile.id, token);
  return back("connected");
}
