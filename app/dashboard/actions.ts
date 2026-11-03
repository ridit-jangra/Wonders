"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hasDashboardAccess } from "@/lib/dashboard-access";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { getSessionProfile } from "@/lib/profiles";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeInviteCode } from "@/lib/collab-code";
import { joinByCode } from "@/lib/collaborators";

export interface JoinState {
  error?: string;
}

const MESSAGES = {
  invalid: "that code doesn't match a wonder, double check it :c",
  own: "that's your own wonder :3",
  full: "that wonder's team is full :c",
  banned: "that code doesn't match a wonder, double check it :c",
  closed: "that wonder is all wrapped up already :3",
} as const;

export async function joinWonder(_previous: JoinState, formData: FormData): Promise<JoinState> {
  const store = await cookies();
  const session = verifySessionCookie(store.get(SESSION_COOKIE)?.value);
  if (!session || !(await hasDashboardAccess(session.slackId))) {
    return { error: "sign in again and try once more :c" };
  }
  const profile = await getSessionProfile(session);
  if (!profile) {
    redirect("/onboarding");
  }

  if (!(await checkRateLimit("collab-join", session.slackId, 10, 3600)).allowed) {
    return { error: "too many tries, wait a bit and try again :c" };
  }

  const code = normalizeInviteCode(String(formData.get("code") ?? ""));
  if (!code) {
    return { error: "codes look like ABCD-EFGH :3" };
  }

  const result = await joinByCode(profile.id, code);
  if (!result.ok) {
    return { error: MESSAGES[result.error] };
  }

  revalidatePath("/dashboard");
  revalidatePath("/wonders");
  redirect(`/dashboard/projects/edit/${result.projectId}`);
}
