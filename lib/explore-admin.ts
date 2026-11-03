import "server-only";
import { sql } from "@/lib/db";
import type { ProjectStatus } from "@/lib/projects";

export interface AdminExploreWonder {
  id: number;
  title: string;
  description: string;
  github_url: string | null;
  link_url: string | null;
  image_url: string | null;
  status: ProjectStatus;
  banned_at: string | null;
  owner_name: string;
  owner_slack_id: string;
  owner_slack_name: string | null;
}

function likePattern(q: string) {
  return "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
}

export async function searchWondersAdmin(rawQuery: string): Promise<AdminExploreWonder[]> {
  const q = rawQuery.trim().slice(0, 100);
  const pattern = likePattern(q);
  const idMatch = /^#?\d{1,9}$/.test(q) ? Number(q.replace("#", "")) : null;
  const filter = q
    ? sql`where (
        p.title ilike ${pattern}
        or p.description ilike ${pattern}
        or p.github_url ilike ${pattern}
        or p.link_url ilike ${pattern}
        or o.slack_id ilike ${pattern}
        or o.name ilike ${pattern}
        or o.first_name ilike ${pattern}
        or o.last_name ilike ${pattern}
        or o.slack_display_name ilike ${pattern}
        or o.email ilike ${pattern}
        ${idMatch !== null ? sql`or p.id = ${idMatch}` : sql``}
      )`
    : sql``;
  return sql<AdminExploreWonder[]>`
    select
      p.id, p.title, p.description, p.github_url, p.link_url, p.image_url,
      p.status, p.banned_at,
      o.name as owner_name, o.slack_id as owner_slack_id,
      o.slack_display_name as owner_slack_name
    from projects p join profiles o on o.id = p.profile_id
    ${filter}
    order by p.created_at desc, p.id desc
    limit 100
  `;
}
