/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { getProfile } from "@/lib/profiles";
import { deleteProject, getProject, shipProject, updateProject } from "@/lib/projects";
import { recordProjectHistory } from "@/lib/project-history";
import { notifyPlayer } from "@/lib/notifications";
import { uploadThumbnail } from "@/lib/storage";
import ThumbnailPicker from "@/app/dashboard/components/ThumbnailPicker";
import SubmitButton from "@/app/dashboard/components/SubmitButton";
import DeleteProjectButton from "@/app/dashboard/components/DeleteProjectButton";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/login");
  }

  const profile = await getProfile(session.slackId);
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

  const missingForShip = [
    !project.image_url && "a thumbnail",
    !project.link_url && "a demo url",
    !project.github_url && "a github url",
  ].filter((v): v is string => Boolean(v));

  async function submitProject(formData: FormData) {
    "use server";

    const store = await cookies();
    const current = verifySessionCookie(store.get(SESSION_COOKIE)?.value);
    if (!current) {
      redirect("/login");
    }

    const currentProfile = await getProfile(current.slackId);
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

    const currentProfile = await getProfile(current.slackId);
    if (!currentProfile) {
      redirect("/onboarding");
    }

    const existing = await getProject(id);
    if (!existing || existing.profile_id !== currentProfile.id) {
      redirect("/wonders");
    }
    if (!existing.image_url || !existing.link_url || !existing.github_url) {
      return;
    }

    const shipped = await shipProject(id, currentProfile.id);
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

    const currentProfile = await getProfile(current.slackId);
    if (!currentProfile) {
      redirect("/onboarding");
    }

    await deleteProject(id, currentProfile.id);
    revalidatePath("/dashboard");
    revalidatePath("/wonders");
  }

  return (
    <div className="relative flex min-h-screen flex-col gap-6 bg-[#F0EBD1] px-6 pt-24 pb-10 sm:px-10 md:bg-transparent md:px-14 md:py-16 lg:py-28">
      <img
        src="/new-or-edit-projects-template.png"
        alt=""
        className="fixed top-0 right-[12%] bottom-[14%] left-[7.5%] -z-10 hidden h-full w-full object-contain md:block"
      />
      <h1 className="font-finger-paint text-3xl text-[#5C4A2E] sm:text-4xl lg:text-5xl">
        Edit your Wonder
      </h1>
      <form
        action={submitProject}
        className="w-full md:max-w-[84%]"
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
        <div className="w-full rounded-md bg-[#F2B3AD]/30 p-4 md:max-w-[84%]">
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
          className="flex w-full flex-col gap-2 md:max-w-[84%]"
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
