import "server-only";
import { sql } from "@/lib/db";

export interface SharedWonder {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  link_url: string | null;
  github_url: string | null;
  makers: { name: string; avatarUrl: string | null }[];
}

export async function getSharedWonder(id: string): Promise<SharedWonder | null> {
  if (!/^\d{1,9}$/.test(id)) return null;
  const [row] = await sql<
    {
      id: number;
      title: string;
      description: string;
      image_url: string | null;
      link_url: string | null;
      github_url: string | null;
    }[]
  >`
    select id, title, description, image_url, link_url, github_url
    from projects
    where id = ${id}
      and status in ('shipped', 'fulfillment_started', 'fulfilled')
      and banned_at is null
  `;
  if (!row) return null;

  const makers = await sql<{ name: string; avatar_url: string | null }[]>`
    select coalesce(nullif(o.slack_display_name, ''), 'a maker') as name, o.slack_avatar_url as avatar_url
    from projects p join profiles o on o.id = p.profile_id
    where p.id = ${row.id}
    union all
    select coalesce(nullif(o.slack_display_name, ''), 'a maker'), o.slack_avatar_url
    from project_collaborators c join profiles o on o.id = c.profile_id
    where c.project_id = ${row.id}
  `;
  return {
    ...row,
    makers: makers.map((maker) => ({ name: maker.name, avatarUrl: maker.avatar_url })),
  };
}
