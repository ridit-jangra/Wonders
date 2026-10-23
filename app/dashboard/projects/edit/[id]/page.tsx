/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { getHackatimeToken, getSessionProfile } from "@/lib/profiles";
import { fetchHackatimeProjects } from "@/lib/hackatime";
import { deleteProject, getProject, shipProject, updateProject } from "@/lib/projects";
import { recordProjectHistory } from "@/lib/project-history";
import { notifyPlayer } from "@/lib/notifications";
import { uploadThumbnail } from "@/lib/storage";
import ThumbnailPicker from "@/app/dashboard/components/ThumbnailPicker";
import HackatimeProjectSelect from "@/app/dashboard/components/HackatimeProjectSelect";
import SubmitButton from "@/app/dashboard/components/SubmitButton";
import DeleteProjectButton from "@/app/dashboard/components/DeleteProjectButton";

const HACKATIME_NOTICE: Record<string, string> = {
  connected: "hackatime connected :D",
  failed: "couldn't connect hackatime, try again :(",
  mismatch:
    "that hackatime account isn't the one linked to your slack, log into your own hackatime and try again :(",
};

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

  const profile = await getSessionProfile(session);
  if (!profile) {
    redirect("/onboarding");
  }

  const project = await getProject(id);
  if (!project || project.profile_id !== profile.id) {
    redirect("/wonders");
  }

  const editable = project.status === "building" || project.status === "rejected";
  const lockedLabel =
    project.status === "in_review" || project.status === "second_pass"
      ? "in review :3"
      : "shipped :D";

  const hackatimeConnected = Boolean(profile.hackatime_connected_at);
  const hackatimeToken =
    editable && hackatimeConnected ? await getHackatimeToken(profile.id) : null;
  const hackatimeProjects = hackatimeToken
    ? await fetchHackatimeProjects(hackatimeToken)
    : null;
  const hackatimeChoices = [
    ...new Set([
      ...project.hackatime_projects,
      ...(hackatimeProjects ?? []).map((p) => p.name),
    ]),
  ];

  const missingForShip = [
    !project.image_url && "a thumbnail",
    !project.link_url && "a demo url",
    !project.github_url && "a github url",
    !hackatimeConnected && "your hackatime",
    hackatimeConnected &&
      project.hackatime_projects.length === 0 &&
      "a hackatime project",
  ].filter((v): v is string => Boolean(v));

  async function submitProject(formData: FormData) {
    "use server";

    const store = await cookies();
    const current = verifySessionCookie(store.get(SESSION_COOKIE)?.value);
    if (!current) {
      redirect("/login");
    }

    const currentProfile = await getSessionProfile(current);
    if (!currentProfile) {
      redirect("/onboarding");
    }

    const existing = await getProject(id);
    if (!existing || existing.profile_id !== currentProfile.id) {
      redirect("/wonders");
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
      hackatime_projects: hackatimeLinks,
    });
    redirect("/wonders");
  }

  async function shipProjectAction() {
    "use server";

    const store = await cookies();
    const current = verifySessionCookie(store.get(SESSION_COOKIE)?.value);
    if (!current) {
      redirect("/login");
    }

    const currentProfile = await getSessionProfile(current);
    if (!currentProfile) {
      redirect("/onboarding");
    }

    const existing = await getProject(id);
    if (!existing || existing.profile_id !== currentProfile.id) {
      redirect("/wonders");
    }
    if (
      !existing.image_url ||
      !existing.link_url ||
      !existing.github_url ||
      !currentProfile.hackatime_connected_at ||
      existing.hackatime_projects.length === 0
    ) {
      return;
    }

    const token = await getHackatimeToken(currentProfile.id);
    const tracked = token ? await fetchHackatimeProjects(token) : null;
    const hackatimeSeconds = tracked
      ? tracked
          .filter((p) => existing.hackatime_projects.includes(p.name))
          .reduce((sum, p) => sum + p.seconds, 0)
      : null;

    const shipped = await shipProject(id, currentProfile.id, hackatimeSeconds);
    if (shipped) {
      await recordProjectHistory({
        projectId: id,
        profileId: currentProfile.id,
        fromStatus: existing.status,
        toStatus: "in_review",
        reviewerNote: null,
        reward: null,
        reviewedBy: current.slackId,
      });
      notifyPlayer(current.slackId, "in_review", { title: existing.title });
    }

    revalidatePath("/dashboard");
    revalidatePath("/wonders");
    redirect("/wonders");
  }

  async function deleteProjectAction() {
    "use server";

    const store = await cookies();
    const current = verifySessionCookie(store.get(SESSION_COOKIE)?.value);
    if (!current) {
      redirect("/login");
    }

    const currentProfile = await getSessionProfile(current);
    if (!currentProfile) {
      redirect("/onboarding");
    }

    await deleteProject(id, currentProfile.id);
    revalidatePath("/dashboard");
    revalidatePath("/wonders");
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
      <h1 className="font-finger-paint text-3xl text-[#5C4A2E] sm:text-4xl lg:text-5xl">
        Edit your Wonder
      </h1>
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
            className="w-full font-finger-paint resize-none border border-[#8C8368]/30 bg-[#E7E2C9] px-4 py-3 text-base text-[#5C4A2E] placeholder:text-[#8C8368] focus:border-[#8C8368] focus:outline-none md:border-0"
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
                {(editable ? hackatimeChoices : project.hackatime_projects).length === 0 ? (
                  <p className="font-finger-paint text-sm text-[#5C4A2E]/70">
                    no hackatime projects yet, code a bit with hackatime running and they&apos;ll show up here
                  </p>
                ) : (
                  <HackatimeProjectSelect
                    options={editable ? hackatimeChoices : project.hackatime_projects}
                    defaultSelected={project.hackatime_projects}
                    disabled={!editable}
                  />
                )}
              </>
            )}
          </div>
        </fieldset>
        {editable ? (
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-end">
            <DeleteProjectButton
              action={deleteProjectAction}
              label="Delete it :("
              className="w-full rounded-md bg-[#F2B3AD] px-4 py-2 font-finger-paint text-lg text-black/40 hover:zoom-110 transition-all sm:w-48"
            />
            <SubmitButton
              pendingLabel="saving it... :3"
              className="w-full rounded-md bg-[#D1E4B5] px-4 py-2 font-finger-paint text-lg text-black/40 hover:zoom-110 transition-all sm:w-48"
            >
              Save it :3
            </SubmitButton>
          </div>
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
          </div>
        )}
      </form>
      {project.status === "rejected" && (
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
      {(project.status === "building" || project.status === "rejected") && (
        <form
          action={shipProjectAction}
          className="flex w-full flex-col gap-2 md:max-w-[90%]"
        >
          <p className="font-finger-paint text-[#5C4A2E]/70">
            done building? ship it for review :3
          </p>
          {missingForShip.length > 0 && (
            <p className="font-finger-paint text-sm text-[#F2B3AD]">
              add {missingForShip.join(", ")} before you can ship it
            </p>
          )}
          <SubmitButton
            pendingLabel="shipping it... :3"
            disabled={missingForShip.length > 0}
            className="w-full rounded-md bg-[#A8C7E0] px-4 py-2 font-finger-paint text-lg text-black/40 hover:zoom-110 transition-all sm:w-48"
          >
            Ship it :D
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
