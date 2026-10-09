import "server-only";
import { supabase } from "@/lib/supabase";

export type ProjectStatus =
  | "building"
  | "in_review"
  | "second_pass"
  | "rejected"
  | "approved"
  | "shipped"
  | "fulfillment_started"
  | "fulfilled";

export type ProjectId = string | number;

export interface Project {
  id: number;
  profile_id: string;
  title: string;
  description: string;
  image_url: string | null;
  link_url: string | null;
  github_url: string | null;
  status: ProjectStatus;
  reviewer_note: string | null;
  reward: string | null;
  created_at: string;
}

export async function getProjects(profileId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, profile_id, title, description, image_url, link_url, github_url, status, reviewer_note, reward, created_at",
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }
  return data;
}

export async function createProject(
  profileId: string,
  data: {
    title: string;
    description: string;
    link_url?: string;
    github_url?: string;
    image_url?: string | null;
  },
): Promise<Project> {
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      profile_id: profileId,
      title: data.title,
      description: data.description,
      link_url: data.link_url || null,
      github_url: data.github_url || null,
      image_url: data.image_url ?? null,
    })
    .select(
      "id, profile_id, title, description, image_url, link_url, github_url, status, reviewer_note, reward, created_at",
    )
    .single();

  if (error) {
    throw error;
  }
  return project;
}

export async function getProject(id: ProjectId): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, profile_id, title, description, image_url, link_url, github_url, status, reviewer_note, reward, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

export async function updateProject(
  id: ProjectId,
  profileId: string,
  data: {
    title: string;
    description: string;
    link_url?: string;
    github_url?: string;
    image_url?: string | null;
  },
) {
  const { error } = await supabase
    .from("projects")
    .update({
      title: data.title,
      description: data.description,
      link_url: data.link_url || null,
      github_url: data.github_url || null,
      ...(data.image_url !== undefined ? { image_url: data.image_url } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }
}

export async function shipProject(
  id: ProjectId,
  profileId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("projects")
    .update({ status: "in_review", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", profileId)
    .in("status", ["building", "rejected"])
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data !== null;
}

export async function deleteProject(id: ProjectId, profileId: string) {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }
}


export interface ProjectOwner {
  name: string;
  slack_id: string;
  email: string;
  slack_display_name: string | null;
  slack_avatar_url: string | null;
}

export interface ProjectWithOwner extends Project {
  fulfilled_at: string | null;
  fulfilled_by: string | null;
  on_hold: boolean;
  hold_reason: string | null;
  profile: ProjectOwner;
}

const ADMIN_COLUMNS =
  "id, profile_id, title, description, image_url, link_url, github_url, status, reviewer_note, reward, created_at, fulfilled_at, fulfilled_by, on_hold, hold_reason, profile:profiles(name, slack_id, email, slack_display_name, slack_avatar_url)";

export async function listAllProjects(opts: {
  status?: ProjectStatus | ProjectStatus[];
  search?: string;
  limit: number;
  offset: number;
}): Promise<{ projects: ProjectWithOwner[]; total: number }> {
  let query = supabase
    .from("projects")
    .select(ADMIN_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  if (opts.status) {
    query = Array.isArray(opts.status)
      ? query.in("status", opts.status)
      : query.eq("status", opts.status);
  }
  if (opts.search) {
    query = query.ilike("title", `%${opts.search}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }
  return { projects: data as unknown as ProjectWithOwner[], total: count ?? 0 };
}

export async function getProjectWithOwner(
  id: ProjectId,
): Promise<ProjectWithOwner | null> {
  const { data, error } = await supabase
    .from("projects")
    .select(ADMIN_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data as unknown as ProjectWithOwner | null;
}

export async function countProjectsByStatus(): Promise<
  Record<ProjectStatus, number>
> {
  const { data, error } = await supabase.from("projects").select("status");
  if (error) {
    throw error;
  }

  const counts: Record<ProjectStatus, number> = {
    building: 0,
    in_review: 0,
    second_pass: 0,
    rejected: 0,
    approved: 0,
    shipped: 0,
    fulfillment_started: 0,
    fulfilled: 0,
  };
  for (const row of data) {
    counts[row.status as ProjectStatus]++;
  }
  return counts;
}

export async function firstPassReview(
  id: ProjectId,
  verdict: "approved" | "changes_requested",
  feedback: string,
): Promise<boolean> {
  let nextStatus: ProjectStatus = "rejected";
  if (verdict === "approved") {
    nextStatus = "second_pass";
  }

  const { data, error } = await supabase
    .from("projects")
    .update({
      status: nextStatus,
      reviewer_note: feedback,
      on_hold: false,
      hold_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "in_review")
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data !== null;
}

export async function secondPassReview(
  id: ProjectId,
  verdict: "approved" | "changes_requested",
  feedback: string,
): Promise<boolean> {
  let nextStatus: ProjectStatus = "rejected";
  if (verdict === "approved") {
    nextStatus = "shipped";
  }

  const { data, error } = await supabase
    .from("projects")
    .update({
      status: nextStatus,
      reviewer_note: feedback,
      on_hold: false,
      hold_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "second_pass")
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data !== null;
}

export async function setProjectHold(id: ProjectId, onHold: boolean, reason: string | null) {
  const { error } = await supabase
    .from("projects")
    .update({
      on_hold: onHold,
      hold_reason: onHold ? reason : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["in_review", "second_pass"]);

  if (error) {
    throw error;
  }
}

export async function adminUpdateProject(
  id: ProjectId,
  fields: {
    title: string;
    description: string;
    image_url: string | null;
    link_url: string | null;
    github_url: string | null;
  },
) {
  const { error } = await supabase
    .from("projects")
    .update({
      title: fields.title,
      description: fields.description,
      image_url: fields.image_url,
      link_url: fields.link_url,
      github_url: fields.github_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function startFulfillment(id: ProjectId): Promise<boolean> {
  const { data, error } = await supabase
    .from("projects")
    .update({ status: "fulfillment_started", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "shipped")
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data !== null;
}

export async function fulfillProject(
  id: ProjectId,
  adminSlackId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("projects")
    .update({
      status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
      fulfilled_by: adminSlackId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "fulfillment_started")
    .not("reward", "is", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data !== null;
}

export async function setProjectReward(id: ProjectId, reward: string | null) {
  const { error } = await supabase
    .from("projects")
    .update({ reward, updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["shipped", "fulfillment_started"]);

  if (error) {
    throw error;
  }
}
