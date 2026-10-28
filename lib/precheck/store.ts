import "server-only";
import crypto from "node:crypto";
import { sql } from "@/lib/db";
import type { ProjectId } from "@/lib/projects";

export type AutoCheckStatus = "none" | "pending" | "clear" | "flagged" | "sent_back" | "error";

export interface AutoCheckFinding {
  id: string;
  label: string;
  evidence: string;
}

export interface AutoCheckFindings {
  checks: {
    repo: string;
    demo: string;
    demoStatus: number | null;
    readme: string;
  };
  blocking: AutoCheckFinding[];
  skipped: string[];
  notes: string[];
  redFlags: string[];
  strengths: string[];
  review: string;
  sentBack: boolean;
}

export interface PrecheckProject {
  id: number;
  profile_id: string;
  title: string;
  description: string;
  github_url: string | null;
  link_url: string | null;
  status: string;
  ai_review_status: AutoCheckStatus;
  ai_review_token: string | null;
  ai_precheck_sendbacks: number;
  owner_slack_id: string;
}

export const PRECHECK_HIDE_MINUTES = 5;

export async function beginPrecheck(id: ProjectId, profileId: string): Promise<string | null> {
  const token = crypto.randomUUID();
  const rows = await sql`
    update projects set
      ai_review_status = 'pending',
      ai_review_token = ${token},
      ai_review_started_at = now(),
      ai_review_error = null,
      ai_review_summary = null,
      ai_review_findings = null,
      ai_review_model = null,
      ai_reviewed_at = null,
      updated_at = now()
    where id = ${id}
      and profile_id = ${profileId}
      and status = 'in_review'
    returning id
  `;
  return rows.length > 0 ? token : null;
}

export async function getPrecheckProject(id: ProjectId): Promise<PrecheckProject | null> {
  const [row] = await sql<PrecheckProject[]>`
    select
      p.id, p.profile_id, p.title, p.description, p.github_url, p.link_url,
      p.status, p.ai_review_status, p.ai_review_token, p.ai_precheck_sendbacks,
      o.slack_id as owner_slack_id
    from projects p
    join profiles o on o.id = p.profile_id
    where p.id = ${id}
  `;
  return row ?? null;
}

interface Outcome {
  status: "clear" | "flagged" | "error";
  summary: string;
  findings: AutoCheckFindings | null;
  error: string;
  model: string;
}

export async function finishPrecheck(id: ProjectId, token: string, outcome: Outcome): Promise<boolean> {
  const rows = await sql`
    update projects set
      ai_review_status = ${outcome.status},
      ai_review_summary = ${outcome.summary},
      ai_review_findings = ${outcome.findings ? sql.json(outcome.findings as unknown as Parameters<typeof sql.json>[0]) : null},
      ai_review_error = ${outcome.error.slice(0, 500)},
      ai_review_model = ${outcome.model},
      ai_reviewed_at = now()
    where id = ${id}
      and status = 'in_review'
      and ai_review_status = 'pending'
      and ai_review_token = ${token}
    returning id
  `;
  return rows.length > 0;
}

export async function sendBackAfterPrecheck(
  id: ProjectId,
  token: string,
  note: string,
  outcome: { summary: string; findings: AutoCheckFindings; error: string; model: string },
): Promise<boolean> {
  const rows = await sql`
    update projects set
      status = 'rejected',
      reviewer_note = ${note},
      on_hold = false,
      hold_reason = null,
      ai_review_status = 'sent_back',
      ai_review_summary = ${outcome.summary},
      ai_review_findings = ${sql.json(outcome.findings as unknown as Parameters<typeof sql.json>[0])},
      ai_review_error = ${outcome.error.slice(0, 500)},
      ai_review_model = ${outcome.model},
      ai_reviewed_at = now(),
      ai_precheck_sendbacks = ai_precheck_sendbacks + 1,
      updated_at = now()
    where id = ${id}
      and status = 'in_review'
      and ai_review_status = 'pending'
      and ai_review_token = ${token}
    returning id
  `;
  return rows.length > 0;
}
