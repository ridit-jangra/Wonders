import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("projects")
    .select("title, description, github_url, link_url");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const projects = data.map((p) => ({
    name: p.title,
    description: p.description,
    repo_url: p.github_url,
    demo_url: p.link_url,
  }));

  return NextResponse.json({ projects });
}
