import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appUrl, SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { limitByIp, requestIp } from "@/lib/rate-limit";
import {
  findReferrerBySlug,
  isReferralSlug,
  recordClick,
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE,
  visitorHash,
} from "@/lib/referrals";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const limited = await limitByIp(request, "referral-click", 60, 60);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const referrer = isReferralSlug(slug) ? await findReferrerBySlug(slug) : null;
  if (!referrer) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  const session = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (session) {
    return NextResponse.redirect(appUrl("/dashboard", request));
  }

  await recordClick(
    referrer.id,
    visitorHash(requestIp(request), request.headers.get("user-agent") ?? ""),
  );

  const response = NextResponse.redirect(appUrl("/login", request));
  response.cookies.set(REFERRAL_COOKIE, slug, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: REFERRAL_COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}
