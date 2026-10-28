import "server-only";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { clientIp } from "@/lib/security/client-ip";
import { retryAfterSeconds, windowStartMs } from "@/lib/security/rate-window";

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: number };

export async function checkRateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const start = new Date(windowStartMs(now, windowSeconds)).toISOString();

  try {
    const [row] = await sql<{ count: number }[]>`
      insert into rate_limits (bucket, window_start, count)
      values (${`${bucket}:${identifier}`}, ${start}, 1)
      on conflict (bucket, window_start)
      do update set count = rate_limits.count + 1
      returning count
    `;

    if (Math.random() < 0.02) {
      void sql`delete from rate_limits where window_start < now() - interval '1 day'`.catch(
        () => undefined,
      );
    }

    if (row.count > limit) {
      return { allowed: false, retryAfter: retryAfterSeconds(now, windowSeconds) };
    }
    return { allowed: true };
  } catch (error) {
    console.error("rate limit check failed, denying:", (error as Error).message);
    return { allowed: false, retryAfter: 30 };
  }
}

export function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: "Too many requests. Try again in a bit." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export function requestIp(request: { headers: Headers }) {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  return clientIp(request.headers, Number.isFinite(hops) && hops > 0 ? hops : 1);
}

export async function limitByIp(
  request: { headers: Headers },
  bucket: string,
  limit: number,
  windowSeconds: number,
) {
  const result = await checkRateLimit(bucket, requestIp(request), limit, windowSeconds);
  return result.allowed ? null : tooManyRequests(result.retryAfter);
}
