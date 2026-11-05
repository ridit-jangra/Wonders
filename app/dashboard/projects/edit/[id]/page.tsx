/* eslint-disable @next/next/no-img-element */
import { hasDashboardAccess } from "@/lib/dashboard-access";
import UnderConstruction from "@/app/components/UnderConstruction";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import {
  getHackatimeToken,
  getPhonePrefill,
  getSessionProfile,
  getSlackActors,
  saveShippingPhone,
  saveShippingPhoneIfMissing,
} from "@/lib/profiles";
import {
  computeTeamSeconds,
  computeWonderSeconds,
  saveCollaboratorSeconds,
  getCollaboratorLinks,
  getInviteCode,
  getRole,
  listMembers,
  listTeammatePhoneStatus,
  removeCollaborator,
  resetInviteCode,
  setCollaboratorLinks,
} from "@/lib/collaborators";
import { fetchHackatimeProjects } from "@/lib/hackatime";
import {
  deleteProject,
  getProject,
  getQueuePosition,
  SHIP_AGAIN_MIN_SECONDS,
  shipProject,
  unshipProject,
  updateProject,
} from "@/lib/projects";
import ShipDialogButton from "@/app/dashboard/components/ShipDialogButton";
import { normalizePhone, splitPhone } from "@/lib/phone";
import { getProjectTimeline, hasBeenShipped, recordProjectHistory } from "@/lib/project-history";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import { notifyTeam } from "@/lib/notifications";
import { precheckEnabled, runPrecheck } from "@/lib/precheck/run";
import { beginPrecheck } from "@/lib/precheck/store";
import { uploadThumbnail } from "@/lib/storage";
import {
  addJournalEntry,
  deleteJournalEntry,
  editJournalEntry,
  listJournalForMember,
} from "@/lib/journal";
import { JOURNAL_MAX_CONTENT, journalLocked } from "@/lib/journal-shared";
import Journal, { type JournalResult } from "@/app/dashboard/components/Journal";
import ThumbnailPicker from "@/app/dashboard/components/ThumbnailPicker";
import HackatimeProjectSelect from "@/app/dashboard/components/HackatimeProjectSelect";
import SubmitButton from "@/app/dashboard/components/SubmitButton";
import AutoSave from "@/app/dashboard/components/AutoSave";
import LockRibbons from "@/app/dashboard/components/LockRibbons";
import ProjectTimeline from "@/app/dashboard/components/ProjectTimeline";
import DeleteProjectButton from "@/app/dashboard/components/DeleteProjectButton";
import CopyCode from "@/app/dashboard/components/CopyCode";
import BackButton from "@/app/dashboard/components/BackButton";
import { YSWS } from "@/lib/ysws-config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HACKATIME_NOTICE: Record<string, string> = {
  connected: "hackatime connected :D",
  failed: "couldn't connect hackatime, try again :(",
  mismatch:
    "that hackatime account isn't the one linked to your slack, log into your own hackatime and try again :(",
};

type JournalGuard = { error: string; profileId?: undefined } | { error?: undefined; profileId: string };

async function journalGuard(id: string, bucket: string, limit: number): Promise<JournalGuard | null> {
  const store = await cookies();
  const current = verifySessionCookie(store.get(SESSION_COOKIE)?.value);
  if (!current || !(await hasDashboardAccess(current.slackId))) {
    return null;
  }
  const currentProfile = await getSessionProfile(current);
  if (!currentProfile) {
    return null;
  }
  const existing = await getProject(id);
  if (!existing || !(await getRole(existing.id, currentProfile.id))) {
    return null;
  }
  if (journalLocked(existing.status)) {
    return { error: "the journal is locked while your wonder is in review" };
  }
  if (!(await checkRateLimit(bucket, current.slackId, limit, 60)).allowed) {
    return { error: "slow down a little and try again :3" };
  }
  return { profileId: currentProfile.id };
}

async function memberContext(id: string) {
  const store = await cookies();
  const current = verifySessionCookie(store.get(SESSION_COOKIE)?.value);
  if (!current || !(await hasDashboardAccess(current.slackId))) {
    return null;
  }
  const profile = await getSessionProfile(current);
  if (!profile) {
    return null;
  }
  const project = await getProject(id);
  if (!project) {
    return null;
  }
  const role = await getRole(project.id, profile.id);
  if (!role) {
    return null;
  }
  return { current, profile, project, role };
}

export default async function EditProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hackatime?: string }>;
}) {
  const { id } = await params;
  const { hackatime: hackatimeOutcome } = await searchParams;

  const cookieStore = await cookies();
  const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/login");
  }

  if (!(await hasDashboardAccess(session.slackId))) {
    return <UnderConstruction />;
  }

  const profile = await getSessionProfile(session);
  if (!profile) {
    redirect("/onboarding");
  }

  const project = await getProject(id);
  if (!project) {
    redirect("/explore");
  }
  const role = await getRole(project.id, profile.id);
  if (!role) {
    redirect(`/explore/${project.id}`);
  }
  const isCollaborator = role === "collaborator";
  const members = await listMembers(project.id);
  const teammates = await listTeammatePhoneStatus(project.id, profile.id);
  const ownerMember = members.find((member) => member.role === "owner");
  const myLinks = isCollaborator
    ? await getCollaboratorLinks(project.id, profile.id)
    : project.hackatime_projects;
  const inviteCode = isCollaborator ? null : await getInviteCode(project.id, profile.id);

  const isBanned = Boolean(project.banned_at);
  const liveEdit = (project.status === "shipped" || project.status === "fulfillment_started") && !isBanned;
  const editable = ((project.status === "building" || project.status === "rejected") && !isBanned) || liveEdit;
  const underReview = project.status === "in_review" || project.status === "second_pass";
  const queue = underReview ? await getQueuePosition(project.id) : null;
  const lockedLabel = isBanned ? "banned :(" : underReview ? "in review :3" : "shipped :D";

  const timeline = await getProjectTimeline(project.id, project.profile_id);
  const phonePrefill = await getPhonePrefill(profile.id);
  const phoneStart = splitPhone(phonePrefill.phone);
  const isReship = project.status === "rejected" || (await hasBeenShipped(project.id, project.profile_id));
  const journal = await listJournalForMember(project.id, profile.id);
  const actors = await getSlackActors([
    ...members.map((member) => member.slackId),
    ...timeline.map((entry) => entry.actorSlackId),
  ]);

  const hackatimeConnected = Boolean(profile.hackatime_connected_at);
  const hackatimeToken =
    editable && hackatimeConnected ? await getHackatimeToken(profile.id) : null;
  const hackatimeProjects = hackatimeToken
    ? await fetchHackatimeProjects(hackatimeToken)
    : null;
  const currentTrackedSeconds = liveEdit ? await computeWonderSeconds(project) : null;
  const canShipAgain =
    !liveEdit ||
    (currentTrackedSeconds !== null &&
      currentTrackedSeconds >= (project.hackatime_seconds ?? 0) + SHIP_AGAIN_MIN_SECONDS);

  const hackatimeChoices = [
    ...new Set([
      ...myLinks,
      ...(hackatimeProjects ?? []).map((p) => p.name),
    ]),
  ];

  const missingForShip = [
    !project.image_url && "a thumbnail",
    !project.link_url && "a demo url",
    !project.github_url && "a github url",
    !hackatimeConnected && "your hackatime",
    hackatimeConnected &&
      myLinks.length === 0 &&
      "a hackatime project",
  ].filter((v): v is string => Boolean(v));

  async function submitProject(formData: FormData) {
    "use server";

    const store = await cookies();
    const current = verifySessionCookie(store.get(SESSION_COOKIE)?.value);
    if (!current) {
      redirect("/login");
    }
    if (!(await hasDashboardAccess(current.slackId))) {
      redirect("/");
    }

    const currentProfile = await getSessionProfile(current);
    if (!currentProfile) {
      redirect("/onboarding");
    }

    const existing = await getProject(id);
    const memberRole = existing ? await getRole(existing.id, currentProfile.id) : null;
    if (!existing || !memberRole) {
      redirect("/wonders");
    }
    const asCollaborator = memberRole === "collaborator";

    if (!(await checkRateLimit("project-save", current.slackId, 30, 60)).allowed) {
      return;
    }

    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const githubUrl = String(formData.get("github-repo-url") ?? "").trim();
    const demoUrl = String(formData.get("demo-url") ?? "").trim();
    const thumbnail = formData.get("thumbnail");
    const removeThumbnail = formData.get("remove-thumbnail") === "1";
    const hackatimeLinks =
      formData.get("hackatime-picker") === "1"
        ? [
            ...new Set(
              formData
                .getAll("hackatime-projects")
                .map((v) => String(v).trim())
                .filter((v) => v.length > 0 && v.length <= 200),
            ),
          ].slice(0, 20)
        : undefined;
    if (!title || !description) {
      return;
    }

    let imageUrl = removeThumbnail ? null : existing.image_url;
    if (thumbnail instanceof File && thumbnail.size > 0) {
      imageUrl = await uploadThumbnail(thumbnail, currentProfile.id);
    }

    await updateProject(id, currentProfile.id, {
      title,
      description,
      link_url: demoUrl,
      github_url: githubUrl,
      image_url: imageUrl,
      ...(asCollaborator ? {} : { hackatime_projects: hackatimeLinks }),
    });
    if (asCollaborator && hackatimeLinks) {
      await setCollaboratorLinks(existing.id, currentProfile.id, hackatimeLinks);
    }
    redirect("/wonders");
  }

  async function autosaveProject(formData: FormData): Promise<{ ok: boolean }> {
    "use server";

    const store = await cookies();
    const current = verifySessionCookie(store.get(SESSION_COOKIE)?.value);
    if (!current || !(await hasDashboardAccess(current.slackId))) {
      return { ok: false };
    }

    const currentProfile = await getSessionProfile(current);
    if (!currentProfile) {
      return { ok: false };
    }

    const existing = await getProject(id);
    const memberRole = existing ? await getRole(existing.id, currentProfile.id) : null;
    const asCollaborator = memberRole === "collaborator";
    if (
      !existing ||
      !memberRole ||
      (existing.status !== "building" &&
        existing.status !== "rejected" &&
        existing.status !== "shipped" &&
        existing.status !== "fulfillment_started")
    ) {
      return { ok: false };
    }

    if (!(await checkRateLimit("project-autosave", current.slackId, 90, 60)).allowed) {
      return { ok: false };
    }

    const title = String(formData.get("title") ?? "").trim();
    if (!title) {
      return { ok: false };
    }

    const description = String(formData.get("description") ?? "").trim();
    const githubUrl = String(formData.get("github-repo-url") ?? "").trim();
    const demoUrl = String(formData.get("demo-url") ?? "").trim();
    const thumbnail = formData.get("thumbnail");
    const removeThumbnail = formData.get("remove-thumbnail") === "1";
    const hackatimeLinks =
      formData.get("hackatime-picker") === "1"
        ? [
            ...new Set(
              formData
                .getAll("hackatime-projects")
                .map((v) => String(v).trim())
                .filter((v) => v.length > 0 && v.length <= 200),
            ),
          ].slice(0, 20)
        : undefined;

    let imageUrl = removeThumbnail ? null : existing.image_url;
    if (thumbnail instanceof File && thumbnail.size > 0) {
      imageUrl = await uploadThumbnail(thumbnail, currentProfile.id);
    }

    await updateProject(id, currentProfile.id, {
      title,
      description,
      link_url: demoUrl,
      github_url: githubUrl,
      image_url: imageUrl,
      ...(asCollaborator ? {} : { hackatime_projects: hackatimeLinks }),
    });
    if (asCollaborator && hackatimeLinks) {
      await setCollaboratorLinks(existing.id, currentProfile.id, hackatimeLinks);
    }

    revalidatePath("/dashboard");
    revalidatePath("/wonders");
    return { ok: true };
  }

  async function shipProjectAction(formData: FormData) {
    "use server";

    const store = await cookies();
    const current = verifySessionCookie(store.get(SESSION_COOKIE)?.value);
    if (!current) {
      redirect("/login");
    }
    if (!(await hasDashboardAccess(current.slackId))) {
      redirect("/");
    }

    const currentProfile = await getSessionProfile(current);
    if (!currentProfile) {
      redirect("/onboarding");
    }

    const existing = await getProject(id);
    const memberRole = existing ? await getRole(existing.id, currentProfile.id) : null;
    if (!existing || !memberRole) {
      redirect("/wonders");
    }
    const asCollaborator = memberRole === "collaborator";
    if (!(await checkRateLimit("project-ship", current.slackId, 10, 60)).allowed) {
      return;
    }
    const shipperLinks = asCollaborator
      ? await getCollaboratorLinks(existing.id, currentProfile.id)
      : existing.hackatime_projects;
    if (
      !existing.image_url ||
      !existing.link_url ||
      !existing.github_url ||
      !currentProfile.hackatime_connected_at ||
      shipperLinks.length === 0
    ) {
      return;
    }

    const phone = normalizePhone(
      String(formData.get("phone_country") ?? ""),
      String(formData.get("phone_number") ?? ""),
    );
    if (!phone) {
      return;
    }
    await saveShippingPhone(currentProfile.id, phone);

    for (const mate of await listTeammatePhoneStatus(existing.id, currentProfile.id)) {
      if (mate.hasPhone) continue;
      const matePhone = normalizePhone(
        String(formData.get(`mate_country_${mate.profileId}`) ?? ""),
        String(formData.get(`mate_phone_${mate.profileId}`) ?? ""),
      );
      if (matePhone && (await saveShippingPhoneIfMissing(mate.profileId, matePhone))) {
        await writeAudit({
          actor: current.slackId,
          action: "ship.teammate_phone",
          target: mate.profileId,
          detail: { project: existing.id },
        });
      }
    }

    const team = await computeTeamSeconds(existing);
    const hackatimeSeconds = team?.total ?? null;

    if (
      (existing.status === "shipped" || existing.status === "fulfillment_started") &&
      (hackatimeSeconds === null ||
        hackatimeSeconds < (existing.hackatime_seconds ?? 0) + SHIP_AGAIN_MIN_SECONDS)
    ) {
      return;
    }

    const wasLive = existing.status === "shipped" || existing.status === "fulfillment_started";
    const shipped = await shipProject(id, currentProfile.id, hackatimeSeconds, team?.owner ?? null);
    if (shipped) {
      await saveCollaboratorSeconds(existing.id, wasLive, team?.collaborators ?? []);
      await recordProjectHistory({
        projectId: id,
        profileId: existing.profile_id,
        fromStatus: existing.status,
        toStatus: "in_review",
        reviewerNote: null,
        reward: null,
        reviewedBy: current.slackId,
      });
      await notifyTeam(existing.id, "in_review", { title: existing.title });

      if (precheckEnabled()) {
        const token = await beginPrecheck(id, existing.profile_id);
        if (token) {
          after(() => runPrecheck(Number(id), token));
        }
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/wonders");
    redirect(`/dashboard/projects/edit/${id}`);
  }

  async function unshipProjectAction() {
    "use server";

    const store = await cookies();
    const current = verifySessionCookie(store.get(SESSION_COOKIE)?.value);
    if (!current) {
      redirect("/login");
    }
    if (!(await hasDashboardAccess(current.slackId))) {
      redirect("/");
    }

    const currentProfile = await getSessionProfile(current);
    if (!currentProfile) {
      redirect("/onboarding");
    }

    const existing = await getProject(id);
    if (!existing || !(await getRole(existing.id, currentProfile.id))) {
      redirect("/wonders");
    }
    if (!(await checkRateLimit("project-unship", current.slackId, 10, 60)).allowed) {
      return;
    }

    const undone = await unshipProject(id, currentProfile.id);
    if (undone) {
      await recordProjectHistory({
        projectId: id,
        profileId: existing.profile_id,
        fromStatus: "in_review",
        toStatus: "building",
        reviewerNote: null,
        reward: null,
        reviewedBy: current.slackId,
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/wonders");
    redirect(`/dashboard/projects/edit/${id}`);
  }

  async function postJournalAction(input: { title: string; content: string }): Promise<JournalResult> {
    "use server";

    const guard = await journalGuard(id, "journal-write", 30);
    if (!guard) return { ok: false, error: "couldn't verify you, reload and try again" };
    if (guard.error !== undefined) return { ok: false, error: guard.error };
    if (
      typeof input?.title !== "string" ||
      typeof input?.content !== "string" ||
      input.content.length > JOURNAL_MAX_CONTENT * 2
    ) {
      return { ok: false, error: "that entry doesn't look right" };
    }
    const added = await addJournalEntry(id, guard.profileId, input);
    return added ? { ok: true } : { ok: false, error: "couldn't save that entry" };
  }

  async function editJournalAction(
    entryId: string,
    input: { title: string; content: string },
  ): Promise<JournalResult> {
    "use server";

    const guard = await journalGuard(id, "journal-write", 30);
    if (!guard) return { ok: false, error: "couldn't verify you, reload and try again" };
    if (guard.error !== undefined) return { ok: false, error: guard.error };
    if (
      !UUID.test(String(entryId)) ||
      typeof input?.title !== "string" ||
      typeof input?.content !== "string" ||
      input.content.length > JOURNAL_MAX_CONTENT * 2
    ) {
      return { ok: false, error: "that entry doesn't look right" };
    }
    const saved = await editJournalEntry(entryId, id, guard.profileId, input);
    return saved ? { ok: true } : { ok: false, error: "couldn't save that entry" };
  }

  async function deleteJournalAction(entryId: string): Promise<JournalResult> {
    "use server";

    const guard = await journalGuard(id, "journal-write", 30);
    if (!guard) return { ok: false, error: "couldn't verify you, reload and try again" };
    if (guard.error !== undefined) return { ok: false, error: guard.error };
    if (!UUID.test(String(entryId))) return { ok: false, error: "that entry doesn't look right" };
    const removed = await deleteJournalEntry(entryId, id, guard.profileId);
    return removed ? { ok: true } : { ok: false, error: "couldn't delete that entry" };
  }

  async function uploadJournalImageAction(
    form: FormData,
  ): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
    "use server";

    const guard = await journalGuard(id, "journal-image", 20);
    if (!guard) return { ok: false, error: "couldn't verify you, reload and try again" };
    if (guard.error !== undefined) return { ok: false, error: guard.error };
    const image = form.get("image");
    if (!(image instanceof File) || image.size === 0) {
      return { ok: false, error: "that isn't an image" };
    }
    try {
      return { ok: true, url: await uploadThumbnail(image, guard.profileId) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "upload failed" };
    }
  }

  async function deleteProjectAction() {
    "use server";

    const store = await cookies();
    const current = verifySessionCookie(store.get(SESSION_COOKIE)?.value);
    if (!current) {
      redirect("/login");
    }
    if (!(await hasDashboardAccess(current.slackId))) {
      redirect("/");
    }

    const currentProfile = await getSessionProfile(current);
    if (!currentProfile) {
      redirect("/onboarding");
    }

    await deleteProject(id, currentProfile.id);
    revalidatePath("/dashboard");
    revalidatePath("/wonders");
  }

  async function createInviteAction() {
    "use server";
    const ctx = await memberContext(id);
    if (!ctx || ctx.role !== "owner" || ctx.project.banned_at) return;
    if (!(await checkRateLimit("collab-invite", ctx.current.slackId, 20, 60)).allowed) return;
    await resetInviteCode(ctx.project.id, ctx.profile.id, "create");
    revalidatePath(`/dashboard/projects/edit/${id}`);
  }

  async function revokeInviteAction() {
    "use server";
    const ctx = await memberContext(id);
    if (!ctx || ctx.role !== "owner") return;
    if (!(await checkRateLimit("collab-invite", ctx.current.slackId, 20, 60)).allowed) return;
    await resetInviteCode(ctx.project.id, ctx.profile.id, "revoke");
    revalidatePath(`/dashboard/projects/edit/${id}`);
  }

  async function removeMemberAction(formData: FormData) {
    "use server";
    const ctx = await memberContext(id);
    if (!ctx || ctx.role !== "owner") return;
    const target = String(formData.get("profile") ?? "");
    if (!UUID.test(target) || target === ctx.profile.id) return;
    if (!(await checkRateLimit("collab-remove", ctx.current.slackId, 20, 60)).allowed) return;
    await removeCollaborator(ctx.project.id, ctx.profile.id, target);
    revalidatePath(`/dashboard/projects/edit/${id}`);
  }

  async function leaveAction() {
    "use server";
    const ctx = await memberContext(id);
    if (!ctx || ctx.role !== "collaborator") return;
    if (!(await checkRateLimit("collab-remove", ctx.current.slackId, 20, 60)).allowed) return;
    await removeCollaborator(ctx.project.id, ctx.profile.id, ctx.profile.id);
    revalidatePath("/dashboard");
    revalidatePath("/wonders");
    redirect("/wonders");
  }

  return (
    <div className="relative flex min-h-screen flex-col gap-6 bg-[#F0EBD1] px-6 pt-24 pb-10 sm:px-10 md:bg-transparent md:pr-14 md:pl-4 md:py-16 lg:py-28">
      <div className="pointer-events-none fixed top-0 right-[2%] bottom-0 left-0 -z-10 hidden md:block md:left-[calc(100vh*554/1080-10vh)]">
        <img
          src="/new-or-edit-projects-template.png"
          alt=""
          className="h-full w-full object-fill"
        />
      </div>
      <div className="relative flex flex-col gap-6 md:-mr-14 md:-ml-4 md:pr-14 md:pl-4">
      {!editable && <LockRibbons />}
      <BackButton href="/wonders" />
      <h1 className="font-finger-paint text-3xl text-[#5C4A2E] sm:text-4xl lg:text-5xl">
        Edit your Wonder
      </h1>
      {(project.status === "shipped" ||
        project.status === "fulfillment_started" ||
        project.status === "fulfilled") &&
        !isBanned && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-finger-paint text-[#5C4A2E]/70">share it :3</p>
            <code className="rounded-md bg-[#E7E2C9] px-3 py-1 font-mono text-sm text-[#5C4A2E]">
              {`${YSWS.origin}/w/${project.id}`}
            </code>
            <CopyCode code={`${YSWS.origin}/w/${project.id}`} />
          </div>
        )}
      {queue && (
        <p className="w-full rounded-md bg-[#E7E2C9] px-4 py-2 font-finger-paint text-lg text-[#5C4A2E] md:max-w-[90%]">
          you&apos;re <span className="text-[#3e7d7d]">#{queue.position}</span> in the review queue
          <span className="text-[#5C4A2E]/60"> (of {queue.total})</span> :3
        </p>
      )}
      {isCollaborator && ownerMember && (
        <p className="font-finger-paint text-[#5C4A2E]/70">
          you&apos;re on {ownerMember.name}&apos;s team for this one :3 you can edit it and ship it, only they can delete it
        </p>
      )}
      <form
        action={submitProject}
        className="w-full md:max-w-[90%]"
      >
        <fieldset
          disabled={!editable}
          className="flex w-full flex-col gap-4 disabled:opacity-70"
        >
          <p className="font-finger-paint text-[#5C4A2E]/70">
            Give your wonder a name :3
          </p>
          <input
            name="title"
            required
            defaultValue={project.title}
            placeholder="give it a name"
            className="w-full border border-[#8C8368]/30 bg-[#E7E2C9] px-4 py-3 font-finger-paint text-base text-[#5C4A2E] placeholder:text-[#8C8368] focus:border-[#8C8368] focus:outline-none md:border-0"
          />
          <p className="font-finger-paint text-[#5C4A2E]/70">
            Give your wonder a description :3
          </p>
          <textarea
            name="description"
            required
            defaultValue={project.description}
            placeholder="what is it? why does it feel like you?"
            rows={5}
            className="wonders-scroll w-full font-finger-paint resize-none border border-[#8C8368]/30 bg-[#E7E2C9] px-4 py-3 text-base text-[#5C4A2E] placeholder:text-[#8C8368] focus:border-[#8C8368] focus:outline-none md:border-0"
          />
          <p className="font-finger-paint text-[#5C4A2E]/70">
            Give your wonder a thumbnail :3
          </p>
          <ThumbnailPicker defaultUrl={project.image_url} />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex w-full flex-col gap-2">
              <p className="font-finger-paint text-[#5C4A2E]/70">
                Github repo url :D
              </p>
              <input
                name="github-repo-url"
                defaultValue={project.github_url ?? ""}
                placeholder="https://"
                className="w-full border border-[#8C8368]/30 bg-[#E7E2C9] px-4 py-3 font-finger-paint text-base text-[#5C4A2E] placeholder:text-[#8C8368] focus:border-[#8C8368] focus:outline-none md:border-0"
              />
            </span>
            <span className="flex w-full flex-col gap-2">
              <p className="font-finger-paint text-[#5C4A2E]/70">Demo url :D</p>
              <input
                name="demo-url"
                defaultValue={project.link_url ?? ""}
                placeholder="https://"
                className="w-full border border-[#8C8368]/30 bg-[#E7E2C9] px-4 py-3 font-finger-paint text-base text-[#5C4A2E] placeholder:text-[#8C8368] focus:border-[#8C8368] focus:outline-none md:border-0"
              />
            </span>
          </div>
          <div className="flex flex-col gap-2 border border-[#8C8368]/30 bg-[#E7E2C9] px-4 py-4 md:border-0">
            <p className="font-finger-paint text-lg text-[#5C4A2E]">
              Connect Hackatime
            </p>
            <p className="font-finger-paint text-sm text-[#5C4A2E]/70">
              Hack Club logs every YSWS project in one shared record, and
              Hackatime is how it knows a project is yours. There&apos;s no
              hour minimum: your wonder is judged on what you built.
            </p>
            {hackatimeOutcome && HACKATIME_NOTICE[hackatimeOutcome] && (
              <p className="font-finger-paint text-sm text-[#5C4A2E]">
                {HACKATIME_NOTICE[hackatimeOutcome]}
              </p>
            )}
            {!hackatimeConnected || (editable && !hackatimeProjects) ? (
              editable && (
                <a
                  href={`/api/hackatime/connect?wonder=${project.id}`}
                  className="mt-1 w-full rounded-md bg-[#A8C7E0] px-4 py-2 text-center font-finger-paint text-lg text-black/40 hover:zoom-110 transition-all sm:w-56"
                >
                  {hackatimeConnected ? "Reconnect Hackatime" : "Connect Hackatime"}
                </a>
              )
            ) : (
              <>
                <p className="font-finger-paint text-[#5C4A2E]/70">
                  which hackatime project is this wonder? :3
                </p>
                {editable && <input type="hidden" name="hackatime-picker" value="1" />}
                {(editable ? hackatimeChoices : myLinks).length === 0 ? (
                  <p className="font-finger-paint text-sm text-[#5C4A2E]/70">
                    no hackatime projects yet, code a bit with hackatime running and they&apos;ll show up here
                  </p>
                ) : (
                  <HackatimeProjectSelect
                    options={editable ? hackatimeChoices : myLinks}
                    defaultSelected={myLinks}
                    disabled={!editable}
                  />
                )}
              </>
            )}
          </div>
        </fieldset>
        {editable ? (
          <>
            <div className="mt-6 flex justify-end">
              <AutoSave action={autosaveProject} />
            </div>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:justify-end">
              {liveEdit || isCollaborator ? (
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-md bg-[#F2B3AD] px-4 py-2 font-finger-paint text-lg text-black/40 opacity-60 sm:w-48"
                >
                  {isCollaborator ? "owner only :3" : lockedLabel}
                </button>
              ) : (
                <DeleteProjectButton
                  action={deleteProjectAction}
                  label="Delete it :("
                  className="w-full rounded-md bg-[#F2B3AD] px-4 py-2 font-finger-paint text-lg text-black/40 hover:zoom-110 transition-all sm:w-48"
                />
              )}
              <SubmitButton
                pendingLabel="saving it... :3"
                className="w-full rounded-md bg-[#D1E4B5] px-4 py-2 font-finger-paint text-lg text-black/40 hover:zoom-110 transition-all sm:w-48"
              >
                Save it :3
              </SubmitButton>
              <ShipDialogButton
                shipAction={shipProjectAction}
                isReship={isReship}
                shipMore={liveEdit}
                disabled={missingForShip.length > 0 || !canShipAgain}
                initialIso={phoneStart?.iso ?? "US"}
                initialNumber={phoneStart?.number ?? ""}
                fromAuth={phonePrefill.fromAuth}
                teammates={teammates}
                className="w-full rounded-md bg-[#A8C7E0] px-4 py-2 font-finger-paint text-lg text-black/40 hover:zoom-110 transition-all sm:w-48"
              />
            </div>
            <p
              className={`mt-3 text-right font-finger-paint text-base ${
                missingForShip.length > 0 ? "text-[#A33B32]" : "text-[#5C4A2E]/70"
              }`}
            >
              {liveEdit
                ? canShipAgain
                  ? "edits show up right away. built more? ship it again and it goes back for another review :3"
                  : "edits show up right away. add some new features to your project to ship it again :3"
                : missingForShip.length > 0
                ? `add ${missingForShip.join(", ")} before you can ${isReship ? "reship" : "ship"} it`
                : isReship
                  ? "fixed it up? reship it for review :3"
                  : "done building? ship it for review :3"}
            </p>
          </>
        ) : (
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-md bg-[#F2B3AD] px-4 py-2 font-finger-paint text-lg text-black/40 opacity-60 sm:w-48"
            >
              {lockedLabel}
            </button>
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-md bg-[#D1E4B5] px-4 py-2 font-finger-paint text-lg text-black/40 opacity-60 sm:w-48"
            >
              {lockedLabel}
            </button>
            {project.status === "in_review" && (
              <SubmitButton
                formAction={unshipProjectAction}
                pendingLabel="unshipping... :3"
                className="w-full rounded-md bg-[#A8C7E0] px-4 py-2 font-finger-paint text-lg text-black/40 hover:zoom-110 transition-all sm:w-48"
              >
                Unship it :c
              </SubmitButton>
            )}
          </div>
        )}
      </form>
      </div>
      {isBanned && (
        <div className="w-full rounded-md bg-[#F2B3AD]/60 p-4 md:max-w-[90%]">
          <p className="font-finger-paint text-[#5C4A2E]">
            this wonder was banned, so it can&apos;t be edited, shipped or deleted :(
          </p>
          {project.ban_reason && (
            <p className="mt-2 font-finger-paint text-sm text-[#5C4A2E]/70">
              &quot;{project.ban_reason}&quot;
            </p>
          )}
          <p className="mt-2 font-finger-paint text-sm text-[#5C4A2E]/70">
            think it&apos;s a mistake? ask in the Wonders channel on Slack :3
          </p>
        </div>
      )}
      {!isBanned && project.status === "building" && project.unship_reason && (
        <div className="w-full rounded-md bg-[#F0E27D]/40 p-4 md:max-w-[90%]">
          <p className="font-finger-paint text-[#5C4A2E]">
            a reviewer moved this back to building :c fix it up and ship it again :3
          </p>
          <p className="mt-2 font-finger-paint text-sm text-[#5C4A2E]/70">
            &quot;{project.unship_reason}&quot;
          </p>
        </div>
      )}
      {project.status === "rejected" && !isBanned && (
        <div className="w-full rounded-md bg-[#F2B3AD]/30 p-4 md:max-w-[90%]">
          <p className="font-finger-paint text-[#5C4A2E]">
            this wasn&apos;t approved — fix it up and ship it again :3
          </p>
          {project.reviewer_note && (
            <p className="mt-2 font-finger-paint text-sm text-[#5C4A2E]/70">
              &quot;{project.reviewer_note}&quot;
            </p>
          )}
        </div>
      )}
      <section className="w-full rounded-md bg-[#E7E2C9] p-4 md:max-w-[90%]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-finger-paint text-xl text-[#5C4A2E]">the team :3</h2>
          <a
            href="/docs/collaborators"
            target="_blank"
            rel="noopener"
            className="font-finger-paint text-[#5C4A2E] inline-block underline hover:zoom-110 transition-all"
          >
            why collaborate?
          </a>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {members.map((member) => (
            <li key={member.profileId} className="flex items-center gap-3">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
              ) : (
                <span className="h-8 w-8 rounded-full bg-[#D9D2B0]" />
              )}
              <span className="font-finger-paint text-[#5C4A2E]">
                {member.name}
                {member.role === "owner" && (
                  <span className="ml-2 text-sm text-[#5C4A2E]/60">(owner)</span>
                )}
                <span className="ml-2 text-sm text-[#5C4A2E]/60">
                  {member.journalCount} {member.journalCount === 1 ? "journal entry" : "journal entries"}
                </span>
              </span>
              {!isCollaborator && member.role === "collaborator" && (
                <form action={removeMemberAction} className="ml-auto">
                  <input type="hidden" name="profile" value={member.profileId} />
                  <SubmitButton
                    pendingLabel="removing..."
                    className="font-finger-paint text-sm text-[#5C4A2E] inline-block underline hover:zoom-110 transition-all"
                  >
                    remove
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
        {!isCollaborator && !isBanned && (
          <div className="mt-4 flex flex-col gap-2">
            <p className="font-finger-paint text-sm text-[#5C4A2E]/70">
              want someone on this wonder with you? give them a code and they can join from their dashboard :3
            </p>
            {inviteCode ? (
              <div className="flex flex-wrap items-center gap-3">
                <code className="rounded-md bg-[#F0EBD1] px-3 py-2 font-mono text-lg tracking-widest text-[#5C4A2E]">
                  {inviteCode}
                </code>
                <CopyCode code={inviteCode} />
                <form action={createInviteAction}>
                  <SubmitButton
                    pendingLabel="making..."
                    className="font-finger-paint text-sm text-[#5C4A2E] inline-block underline hover:zoom-110 transition-all"
                  >
                    new code
                  </SubmitButton>
                </form>
                <form action={revokeInviteAction}>
                  <SubmitButton
                    pendingLabel="turning off..."
                    className="font-finger-paint text-sm text-[#5C4A2E] inline-block underline hover:zoom-110 transition-all"
                  >
                    turn off
                  </SubmitButton>
                </form>
              </div>
            ) : (
              <form action={createInviteAction}>
                <SubmitButton
                  pendingLabel="making it... :3"
                  className="rounded-md bg-[#A8C7E0] px-4 py-2 font-finger-paint text-lg text-black/40 transition-all hover:zoom-110"
                >
                  Invite someone :D
                </SubmitButton>
              </form>
            )}
          </div>
        )}
        {isCollaborator && (
          <form action={leaveAction} className="mt-4">
            <SubmitButton
              pendingLabel="leaving..."
              className="font-finger-paint text-sm text-[#5C4A2E] inline-block underline hover:zoom-110 transition-all"
            >
              leave this wonder
            </SubmitButton>
          </form>
        )}
      </section>
      <Journal
        projectId={Number(project.id)}
        entries={journal}
        locked={journalLocked(project.status)}
        post={postJournalAction}
        edit={editJournalAction}
        remove={deleteJournalAction}
        upload={uploadJournalImageAction}
      />
      <ProjectTimeline
        entries={timeline}
        actors={actors}
        ownerSlackId={ownerMember?.slackId ?? profile.slack_id}
        startedAt={project.created_at}
      />
    </div>
  );
}
