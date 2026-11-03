import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { canManagePlayers } from "@/lib/security/roles";
import { checkRateLimit } from "@/lib/rate-limit";
import { searchWondersAdmin } from "@/lib/explore-admin";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin || !canManagePlayers(admin)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: HEADERS });
  }
  if (!(await checkRateLimit("admin-explore", admin.slackId, 90, 60)).allowed) {
    return NextResponse.json({ error: "Slow down" }, { status: 429, headers: HEADERS });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const wonders = await searchWondersAdmin(q);
    return NextResponse.json({ wonders }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500, headers: HEADERS });
  }
}
