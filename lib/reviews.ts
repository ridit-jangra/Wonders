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

export interface ReviewDraft {
  project_id: number;
  pass: ReviewPass;
  technical_notes: string;
  additional_notes: string;
  feedback: string;
  checks: string[];
  updated_by: string;
  updated_at: string;
}

export async function getReviewDraft(projectId: ProjectId, pass: ReviewPass): Promise<ReviewDraft | null> {
  const [draft] = await sql<ReviewDraft[]>`
    select
      project_id, pass, technical_notes, additional_notes, feedback,
      checks, updated_by, updated_at
    from review_drafts
    where project_id = ${projectId} and pass = ${pass}
  `;
  return draft ?? null;
}

export async function saveReviewDraft(draft: {
  projectId: ProjectId;
  pass: ReviewPass;
  technicalNotes: string;
  additionalNotes: string;
  feedback: string;
  checks: string[];
  updatedBy: string;
}): Promise<string> {
  const [{ updated_at }] = await sql<{ updated_at: string }[]>`
    insert into review_drafts (
      project_id, pass, technical_notes, additional_notes, feedback,
      checks, updated_by, updated_at
    ) values (
      ${Number(draft.projectId)},
      ${draft.pass},
      ${draft.technicalNotes},
      ${draft.additionalNotes},
      ${draft.feedback},
      ${draft.checks},
      ${draft.updatedBy},
      now()
    )
    on conflict (project_id, pass) do update set
      technical_notes = excluded.technical_notes,
      additional_notes = excluded.additional_notes,
      feedback = excluded.feedback,
      checks = excluded.checks,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
    returning updated_at
  `;
  return updated_at;
}

export async function deleteReviewDraft(projectId: ProjectId, pass: ReviewPass) {
  await sql`
    delete from review_drafts
    where project_id = ${projectId} and pass = ${pass}
  `;
}
