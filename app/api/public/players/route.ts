import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, slack_id, email, name");

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("profile_id, title, description, github_url, link_url");

  if (projectsError) {
    return NextResponse.json({ error: projectsError.message }, { status: 500 });
  }

  const players = profiles.map((p) => ({
    slack_name: p.name,
    slack_id: p.slack_id,
    email: p.email,
    projects: projects
      .filter((proj) => proj.profile_id === p.id)
      .map((proj) => ({
        name: proj.title,
        description: proj.description,
        repo_url: proj.github_url,
        demo_url: proj.link_url,
      })),
  }));

  return NextResponse.json({ players });
}
