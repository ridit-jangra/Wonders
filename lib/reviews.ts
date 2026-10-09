import "server-only";
import { supabase } from "@/lib/supabase";
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
  const { error } = await supabase.from("project_reviews").insert({
    project_id: Number(review.projectId),
    pass: review.pass,
    verdict: review.verdict,
    feedback: review.feedback,
    technical_notes: review.technicalNotes,
    additional_notes: review.additionalNotes,
    checks: review.checks,
    reviewed_by: review.reviewedBy,
  });

  if (error) {
    throw error;
  }
}

export async function getProjectReviews(projectId: ProjectId): Promise<ProjectReview[]> {
  const { data, error } = await supabase
    .from("project_reviews")
    .select(
      "id, project_id, pass, verdict, feedback, technical_notes, additional_notes, checks, reviewed_by, created_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }
  return data;
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
  const { data, error } = await supabase
    .from("review_drafts")
    .select("project_id, pass, technical_notes, additional_notes, feedback, checks, updated_by, updated_at")
    .eq("project_id", projectId)
    .eq("pass", pass)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
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
  const updatedAt = new Date().toISOString();

  const { error } = await supabase.from("review_drafts").upsert(
    {
      project_id: Number(draft.projectId),
      pass: draft.pass,
      technical_notes: draft.technicalNotes,
      additional_notes: draft.additionalNotes,
      feedback: draft.feedback,
      checks: draft.checks,
      updated_by: draft.updatedBy,
      updated_at: updatedAt,
    },
    { onConflict: "project_id,pass" },
  );

  if (error) {
    throw error;
  }
  return updatedAt;
}

export async function deleteReviewDraft(projectId: ProjectId, pass: ReviewPass) {
  const { error } = await supabase
    .from("review_drafts")
    .delete()
    .eq("project_id", projectId)
    .eq("pass", pass);

  if (error) {
    throw error;
  }
}
