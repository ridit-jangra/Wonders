import type { MetadataRoute } from "next";
import { sql } from "@/lib/db";
import { source } from "@/lib/source";
import { YSWS } from "@/lib/ysws-config";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${YSWS.origin}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${YSWS.origin}/explore`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    ...source.getPages().map((page) => ({
      url: `${YSWS.origin}${page.url}`,
      changeFrequency: "monthly" as const,
      priority: page.url === "/docs" ? 0.7 : 0.6,
    })),
  ];

  try {
    const rows = await sql<{ id: number; updated_at: string }[]>`
      select id, updated_at from projects
      where status in ('shipped', 'fulfillment_started', 'fulfilled') and banned_at is null
      order by id desc limit 5000
    `;
    for (const row of rows) {
      entries.push({
        url: `${YSWS.origin}/w/${row.id}`,
        lastModified: new Date(row.updated_at),
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  } catch {}

  return entries;
}
