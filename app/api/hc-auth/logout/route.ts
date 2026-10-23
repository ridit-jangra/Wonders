import { NextRequest, NextResponse } from "next/server";
import { appUrl, SESSION_COOKIE } from "@/lib/hc-auth";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(appUrl("/login", request));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
