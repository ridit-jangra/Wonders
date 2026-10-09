import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const PUBLIC_STATUSES = ["shipped", "fulfillment_started", "fulfilled"];

export async function GET() {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, slack_id, slack_display_name, slack_avatar_url, created_at");

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("profile_id, title, description, github_url, link_url")
    .in("status", PUBLIC_STATUSES);

  if (projectsError) {
    return NextResponse.json({ error: projectsError.message }, { status: 500 });
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
