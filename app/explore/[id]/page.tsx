/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { canUseReferrals } from "@/lib/referrals";
import Sidebar from "@/app/dashboard/components/Sidebar";
import { Profile } from "@/app/dashboard/components/Profile";
import TopBlur from "@/app/dashboard/components/TopBlur";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminSession, requireAccess } from "@/lib/admin";
import { canManagePlayers } from "@/lib/security/roles";
import { adminUnshipProject, banProject, getProjectWithOwner, unbanProject } from "@/lib/projects";
import { recordProjectHistory } from "@/lib/project-history";
import { clearClaim } from "@/lib/review-claims";
import { notifyTeam } from "@/lib/notifications";
import { canSeeAdminButton } from "@/lib/dashboard-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import ReasonDialogButton from "../_components/ReasonDialogButton";

const MIN_REASON = 5;
const MAX_REASON = 1000;
const UNSHIPPABLE = ["in_review", "second_pass", "shipped"];

const STATUS_TEXT: Record<string, string> = {
  building: "building",
  in_review: "first review",
  second_pass: "second review",
  rejected: "changes requested",
  approved: "approved",
  shipped: "shipped",
  fulfillment_started: "fulfillment started",
  fulfilled: "fulfilled",
};

type ActionResult = { ok: boolean; error?: string };

function cleanReason(value: string): string | null {
  const reason = String(value ?? "").trim();
  if (reason.length < MIN_REASON || reason.length > MAX_REASON) {
    return null;
  }
  return reason;
}

function refresh(id: string) {
  revalidatePath(`/explore/${id}`);
  revalidatePath("/explore");
  revalidatePath("/dashboard");
  revalidatePath("/wonders");
  revalidatePath("/admin");
  revalidatePath("/admin/review");
  revalidatePath("/admin/fulfillment");
  revalidatePath(`/admin/review/${id}`);
}

async function guard(): Promise<{ admin: Awaited<ReturnType<typeof requireAccess>> } | { error: string }> {
  const current = await requireAccess(canManagePlayers);
  if (!(await checkRateLimit("explore-moderate", current.slackId, 20, 60)).allowed) {
    return { error: "slow down a little :3" };
  }
  return { admin: current };
}

const BUTTON =
  "w-full rounded-md px-5 py-2 text-center font-finger-paint text-lg text-black/50 transition-all hover:zoom-110 sm:w-auto";

export default async function ExploreWonderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdminSession();
  if (!admin || !canManagePlayers(admin) || !/^\d{1,9}$/.test(id)) {
    notFound();
  }

  const project = await getProjectWithOwner(id);
  if (!project) notFound();

  const session = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
  const showRefers = session ? await canUseReferrals(session.slackId) : false;
  const showAdmin = session ? await canSeeAdminButton(session.slackId) : false;

  async function ban(reasonInput: string): Promise<ActionResult> {
    "use server";
    const checked = await guard();
    if ("error" in checked) return { ok: false, error: checked.error };
    const reason = cleanReason(reasonInput);
    if (!reason) return { ok: false, error: `reason must be ${MIN_REASON}-${MAX_REASON} characters` };

    const existing = await getProjectWithOwner(id);
    if (!existing) return { ok: false, error: "wonder not found" };
    if (!(await banProject(id, reason, checked.admin.slackId))) {
      return { ok: false, error: "already banned" };
    }
    await clearClaim(id);
    await writeAudit({
      actor: checked.admin.slackId,
      action: "project.ban",
      target: id,
      detail: { title: existing.title, owner: existing.profile?.slack_id, reason },
    });
    await notifyTeam(existing.id, "banned", { title: existing.title, note: reason });
    refresh(id);
    return { ok: true };
  }

  async function unban(reasonInput: string): Promise<ActionResult> {
    "use server";
    const checked = await guard();
    if ("error" in checked) return { ok: false, error: checked.error };
    const reason = cleanReason(reasonInput);
    if (!reason) return { ok: false, error: `reason must be ${MIN_REASON}-${MAX_REASON} characters` };

    const existing = await getProjectWithOwner(id);
    if (!existing) return { ok: false, error: "wonder not found" };
    if (!(await unbanProject(id))) return { ok: false, error: "it isn't banned" };
    await writeAudit({
      actor: checked.admin.slackId,
      action: "project.unban",
      target: id,
      detail: { title: existing.title, owner: existing.profile?.slack_id, reason },
    });
    await notifyTeam(existing.id, "unbanned", { title: existing.title, note: reason });
    refresh(id);
    return { ok: true };
  }

  async function unship(reasonInput: string): Promise<ActionResult> {
    "use server";
    const checked = await guard();
    if ("error" in checked) return { ok: false, error: checked.error };
    const reason = cleanReason(reasonInput);
    if (!reason) return { ok: false, error: `reason must be ${MIN_REASON}-${MAX_REASON} characters` };

    const existing = await getProjectWithOwner(id);
    if (!existing) return { ok: false, error: "wonder not found" };
    const from = await adminUnshipProject(id, reason);
    if (!from) return { ok: false, error: "this wonder can't be unshipped from its current status" };

    await clearClaim(id);
    await recordProjectHistory({
      projectId: id,
      profileId: existing.profile_id,
      fromStatus: from,
      toStatus: "building",
      reviewerNote: reason,
      reward: existing.reward,
      reviewedBy: checked.admin.slackId,
    });
    await writeAudit({
      actor: checked.admin.slackId,
      action: "project.unship",
      target: id,
      detail: { title: existing.title, owner: existing.profile?.slack_id, from, reason },
    });
    await notifyTeam(existing.id, "unshipped", { title: existing.title, note: reason });
    refresh(id);
    return { ok: true };
  }

  const owner = project.profile;
  const banned = Boolean(project.banned_at);
  const canUnship = UNSHIPPABLE.includes(project.status);
  const ownerName = owner?.name || owner?.slack_display_name || "Unknown";

  return (
    <div className="relative flex min-h-screen">
      <img className="fixed inset-0 -z-10 h-full w-full object-cover" src="/bg-effect-4.png" alt="" />
      <div className="pointer-events-none fixed top-0 right-[2%] bottom-0 left-0 -z-10 hidden md:left-[calc(100vh*554/1080-10vh)] md:block">
        <img src="/new-or-edit-projects-template.png" alt="" className="h-full w-full object-fill" />
      </div>
      <TopBlur />
      {session && <Sidebar showRefers={showRefers} showAdmin={showAdmin} />}
      <main className="relative min-w-0 flex-1 bg-[#F0EBD1] px-6 pb-10 pt-24 sm:px-10 md:bg-transparent md:py-16 md:pl-4 md:pr-14 lg:py-24">
      <div className="flex w-full flex-col gap-5 md:max-w-[90%]">
        <Link href="/explore" className="font-finger-paint text-lg text-[#5C4A2E]/70 hover:underline">
          &lt; back to explore
        </Link>

        <article className="flex flex-col gap-4">
          <img
            src={project.image_url || "/project-image-fallback.png"}
            alt=""
            className="aspect-video w-full rounded-md object-cover"
          />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 wrap-break-word font-finger-paint text-3xl text-[#5C4A2E]">{project.title}</h1>
            <span className="rounded-full bg-[#E7E2C9] px-3 py-1 font-finger-paint text-sm text-[#7A6B4A]">
              {STATUS_TEXT[project.status] ?? project.status}
              {project.on_hold ? " · on hold" : ""}
            </span>
          </div>

          {banned && (
            <div className="rounded-md bg-[#F2B3AD]/50 p-3 font-finger-paint text-[#5C4A2E]">
              <p>banned{project.banned_by ? ` by ${project.banned_by}` : ""}</p>
              <p className="mt-1 text-sm">&quot;{project.ban_reason}&quot;</p>
            </div>
          )}

          <div className="rounded-md bg-[#E7E2C9] p-3 font-finger-paint text-sm text-[#5C4A2E]">
            <p>
              by {ownerName}
              {owner?.slack_display_name ? ` (@${owner.slack_display_name})` : ""}
            </p>
            <p className="text-[#7A6B4A]">{owner?.slack_id}</p>
          </div>

          <p className="whitespace-pre-wrap wrap-break-word rounded-md bg-[#E7E2C9] p-3 font-finger-paint text-[#5C4A2E]">{project.description}</p>

          {(project.github_url || project.link_url) && (
            <div className="flex flex-col gap-3 sm:flex-row">
              {project.github_url && (
                <a
                  href={project.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${BUTTON} bg-[#D0E4B4]`}
                >
                  Repo :D
                </a>
              )}
              {project.link_url && (
                <a
                  href={project.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${BUTTON} bg-[#F0E27D]`}
                >
                  Demo :3
                </a>
              )}
            </div>
          )}
        </article>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href={`/admin/review/${project.id}`} className={`${BUTTON} bg-[#A8C7E0]`}>
            Go to review page
          </Link>
          {canUnship && (
            <ReasonDialogButton
              action={unship}
              label="Unship it"
              prompt="unship this wonder? the owner sees your reason"
              placeholder="what should they fix?"
              confirmLabel="unship it"
              pendingLabel="unshipping..."
              className={`${BUTTON} bg-[#F0E27D]`}
            />
          )}
          {banned ? (
            <ReasonDialogButton
              action={unban}
              label="Unban project"
              prompt="unban this wonder? the owner is DM'd your reason"
              placeholder="why is the ban being lifted?"
              confirmLabel="unban it"
              pendingLabel="unbanning..."
              className={`${BUTTON} bg-[#D1E4B5]`}
            />
          ) : (
            <ReasonDialogButton
              action={ban}
              label="Ban project"
              prompt="ban this wonder? the owner is DM'd your reason"
              placeholder="why is it being banned?"
              confirmLabel="ban it"
              pendingLabel="banning..."
              className={`${BUTTON} bg-[#F2B3AD]`}
            />
          )}
        </div>
      </div>
      </main>
      {session && <Profile />}
    </div>
  );
}
