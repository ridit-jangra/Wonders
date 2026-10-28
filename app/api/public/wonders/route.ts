import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const data = await sql<
      {
        title: string;
        description: string;
        github_url: string | null;
        link_url: string | null;
        image_url: string | null;
        tag: "draft" | "in_review" | "shipped";
      }[]
    >`
      select
        title, description, github_url, link_url, image_url,
        case
          when status in ('shipped', 'fulfillment_started', 'fulfilled') then 'shipped'
          when status in ('in_review', 'second_pass', 'approved') then 'in_review'
          else 'draft'
        end as tag
      from projects
      order by created_at desc, id desc
    `;

    const projects = data.map((p) => ({
      name: p.title,
      description: p.description,
      repo_url: p.github_url,
      demo_url: p.link_url,
      image_url: p.image_url,
      tag: p.tag,
    }));

    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
