import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  if (!deep) {
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    await sql`select 1`;
    return NextResponse.json({ status: "ok", db: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded", db: "down" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
