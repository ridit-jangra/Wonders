import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin";
import { appUrl } from "@/lib/hc-auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(appUrl("/", request), 303);
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}
