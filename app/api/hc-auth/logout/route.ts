import { NextRequest, NextResponse } from "next/server";
import { appUrl, SESSION_COOKIE } from "@/lib/hc-auth";

export async function GET(request: NextRequest) {
  const reason = request.nextUrl.searchParams.get("reason");
  const response = NextResponse.redirect(
    appUrl(reason === "banned" ? "/login?error=banned" : "/login", request),
  );
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
