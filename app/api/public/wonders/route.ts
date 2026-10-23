import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const PUBLIC_STATUSES = ["shipped", "fulfillment_started", "fulfilled"];

export async function GET() {
  try {
    const data = await sql<
      {
        title: string;
        description: string;
        github_url: string | null;
        link_url: string | null;
      }[]
    >`
      select title, description, github_url, link_url
      from projects
      where status = any(${PUBLIC_STATUSES})
    `;

    const projects = data.map((p) => ({
      name: p.title,
      description: p.description,
      repo_url: p.github_url,
      demo_url: p.link_url,
    }));

    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
