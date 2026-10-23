import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const PUBLIC_STATUSES = ["shipped", "fulfillment_started", "fulfilled"];

export async function GET() {
  let profiles, projects;
  try {
    [profiles, projects] = await Promise.all([
      sql<
        {
          id: string;
          slack_id: string;
          slack_display_name: string | null;
          slack_avatar_url: string | null;
          created_at: string;
        }[]
      >`
        select id, slack_id, slack_display_name, slack_avatar_url, created_at
        from profiles
      `,
      sql<
        {
          profile_id: string;
          title: string;
          description: string;
          github_url: string | null;
          link_url: string | null;
        }[]
      >`
        select profile_id, title, description, github_url, link_url
        from projects
        where status = any(${PUBLIC_STATUSES})
      `,
    ]);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  const players = profiles.map((p) => {
    const wonders = projects
      .filter((proj) => proj.profile_id === p.id)
      .map((proj) => ({
        name: proj.title,
        description: proj.description,
        repo_url: proj.github_url,
        demo_url: proj.link_url,
      }));
    return {
      slack_id: p.slack_id,
      slack_name: p.slack_display_name,
      avatar_url: p.slack_avatar_url,
      joined_at: p.created_at,
      wonder_count: wonders.length,
      wonders,
    };
  });

  return NextResponse.json({ players });
}
