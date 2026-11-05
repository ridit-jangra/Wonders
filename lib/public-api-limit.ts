import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { limitByIp } from "@/lib/rate-limit";

export async function limitPublicApi(request: Request, bucket: string) {
  if (request.headers.get("sec-fetch-site") === "same-origin") {
    return null;
  }
  const session = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (session) {
    return null;
  }
  return limitByIp(request, bucket, 60, 60);
}
