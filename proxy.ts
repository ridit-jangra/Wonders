import { NextResponse, type NextRequest } from "next/server";
import {
  isMutatingMethod,
  isSameOriginRequest,
  parseAllowedOrigins,
} from "@/lib/security/origin";

const allowedOrigins = parseAllowedOrigins(process.env.APP_ORIGINS, [
  "https://wonders.hackclub.com",
  "http://localhost:3000",
]);

export function proxy(request: NextRequest) {
  if (!isMutatingMethod(request.method)) {
    return NextResponse.next();
  }

  const allowed = new Set(allowedOrigins);
  if (process.env.NODE_ENV !== "production") {
    const host = request.headers.get("host");
    if (host) {
      allowed.add(`http://${host}`);
    }
  }

  const sameOrigin = isSameOriginRequest(
    {
      origin: request.headers.get("origin"),
      secFetchSite: request.headers.get("sec-fetch-site"),
    },
    allowed,
  );

  if (!sameOrigin) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
