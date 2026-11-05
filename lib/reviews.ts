import "server-only";
import { sql } from "@/lib/db";
import type { ProjectId } from "@/lib/projects";

export type ReviewPass = "first" | "second";

export type ReviewVerdict = "approved" | "changes_requested";

export interface ProjectReview {
  id: string;
  project_id: number;
  pass: ReviewPass;
  verdict: ReviewVerdict;
  feedback: string;
  technical_notes: string | null;
  additional_notes: string | null;
  checks: string[];
  reviewed_by: string;
  created_at: string;
}

export const SECOND_PASS_CHECKS = [
  { key: "demo_works", label: "The demo works and matches the description" },
  { key: "repo_readme", label: "The repo is public and the README explains the project" },
  { key: "commits_real", label: "The commit history shows real, gradual work" },
  { key: "hackatime_matches", label: "Hackatime time lines up with the project" },
  { key: "no_double_dip", label: "Not already shipped to another YSWS (checked Other YSWS)" },
  { key: "first_pass_sound", label: "The first-pass audit note makes sense" },
];

export async function recordReview(review: {
  projectId: ProjectId;
  pass: ReviewPass;
  verdict: ReviewVerdict;
  feedback: string;
  technicalNotes: string;
  additionalNotes: string;
  checks: string[];
  reviewedBy: string;
}) {
  await sql`
    insert into project_reviews (
      project_id, pass, verdict, feedback, technical_notes,
      additional_notes, checks, reviewed_by
    ) values (
      ${Number(review.projectId)},
      ${review.pass},
      ${review.verdict},
      ${review.feedback},
      ${review.technicalNotes},
      ${review.additionalNotes},
      ${review.checks},
      ${review.reviewedBy}
    )
  `;
}

export async function getProjectReviews(projectId: ProjectId): Promise<ProjectReview[]> {
  return sql<ProjectReview[]>`
    select
      id, project_id, pass, verdict, feedback, technical_notes,
      additional_notes, checks, reviewed_by, created_at
    from project_reviews
    where project_id = ${projectId}
    order by created_at desc
  `;
}

export interface ReviewedRow {
  id: string;
  project_id: number;
  title: string;
  image_url: string | null;
  pass: ReviewPass;
  verdict: ReviewVerdict;
  reviewed_by: string;
  reviewer_name: string | null;
  reviewer_profile_id: string | null;
  first_reviewed_by: string | null;
  first_reviewer_name: string | null;
  first_reviewer_profile_id: string | null;
  hackatime_seconds: number | null;
  created_at: string;
  owner_name: string;
  owner_slack_id: string;
  owner_profile_id: string;
}

export async function listRecentReviews(opts: {
  limit: number;
  offset: number;
}): Promise<{ rows: ReviewedRow[]; total: number }> {
  const [rows, [{ total }]] = await Promise.all([
    sql<ReviewedRow[]>`
      select l.*,
        rp.id as reviewer_profile_id,
        coalesce(nullif(rp.slack_display_name, ''), rp.name) as reviewer_name,
        fp.id as first_reviewer_profile_id,
        coalesce(nullif(fp.slack_display_name, ''), fp.name) as first_reviewer_name
      from (
        select distinct on (r.project_id)
          r.id, r.project_id, p.title, p.image_url, p.hackatime_seconds,
          r.pass, r.verdict, r.reviewed_by, r.created_at,
          (select f.reviewed_by from project_reviews f
            where f.project_id = r.project_id and f.pass = 'first'
            order by f.created_at desc limit 1) as first_reviewed_by,
          coalesce(nullif(o.slack_display_name, ''), o.name) as owner_name,
          o.slack_id as owner_slack_id, o.id as owner_profile_id
        from project_reviews r
        join projects p on p.id = r.project_id
        join profiles o on o.id = p.profile_id
        order by r.project_id, r.created_at desc
      ) l
      left join profiles rp on rp.slack_id = l.reviewed_by
      left join profiles fp on fp.slack_id = l.first_reviewed_by
      order by l.created_at desc
      limit ${opts.limit} offset ${opts.offset}
    `,
    sql<{ total: number }[]>`select count(distinct project_id)::int as total from project_reviews`,
  ]);
  return { rows, total };
}
