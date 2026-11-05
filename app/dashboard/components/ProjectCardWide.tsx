/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { getSessionProfile } from "@/lib/profiles";
import { deleteProject, updateProjectImage, type Project } from "@/lib/projects";
import { uploadThumbnail } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import CardImageUpload from "./CardImageUpload";
import DeleteProjectButton from "./DeleteProjectButton";
import LinkPending from "./LinkPending";

const STATUS_LABEL: Record<Project["status"], string> = {
  building: "building :)",
  in_review: "in review :3",
  second_pass: "in review :3",
  rejected: "needs a fix :c",
  approved: "approved :D",
  shipped: "shipped :D",
  fulfillment_started: "reward incoming :3c",
  fulfilled: "wonder complete :3c",
};

export default function ProjectCardWide({
  project,
  className = "w-full max-w-3xl",
}: {
  project: Project;
  className?: string;
}) {
  const editable = (project.status === "building" || project.status === "rejected") && !project.banned_at;
  const imageEditable =
    !project.banned_at &&
    (project.status === "building" ||
      project.status === "rejected" ||
      project.status === "shipped" ||
      project.status === "fulfillment_started");
  const lockedLabel = project.banned_at
    ? "banned :("
    : project.status === "in_review" || project.status === "second_pass"
      ? "in review :3"
      : STATUS_LABEL[project.status];

  async function deleteProjectAction() {
    "use server";

    const cookieStore = await cookies();
    const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
    if (!session) {
      redirect("/login");
    }

    const profile = await getSessionProfile(session);
    if (!profile) {
      redirect("/onboarding");
    }

    await deleteProject(project.id, profile.id);
    revalidatePath("/dashboard");
    revalidatePath("/wonders");
  }

  async function changeImageAction(formData: FormData): Promise<string | null> {
    "use server";

    const cookieStore = await cookies();
    const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
    if (!session) {
      redirect("/login");
    }

    const profile = await getSessionProfile(session);
    if (!profile) {
      redirect("/onboarding");
    }

    if (!(await checkRateLimit("card-image", session.slackId, 20, 3600)).allowed) {
      return "slow down :(";
    }

    const file = formData.get("thumbnail");
    if (!(file instanceof File) || file.size === 0) {
      return "pick an image first";
    }

    try {
      const url = await uploadThumbnail(file, profile.id);
      if (!(await updateProjectImage(project.id, profile.id, url))) {
        return "can't change this one right now";
      }
    } catch {
      return "that image didn't work :(";
    }
    revalidatePath("/dashboard");
    revalidatePath("/wonders");
    return null;
  }

  return (
    <div className={`relative aspect-1327/345 overflow-hidden ${className}`}>
      <img
        src="/project-template-base-with-inputs-1.png"
        alt=""
        className="absolute top-[-51.01%] left-[-25.62%] w-[144.69%] max-w-none"
      />
      {imageEditable ? (
        <CardImageUpload
          src={project.image_url || "/project-image-fallback.png"}
          action={changeImageAction}
          className="absolute top-[5%] left-[3%] h-[74%] w-[36%]"
        />
      ) : (
        <img
          src={project.image_url || "/project-image-fallback.png"}
          alt=""
          className="absolute top-[5%] left-[3%] h-[74%] w-[36%] rounded-md object-cover"
        />
      )}
      <div className="absolute top-[5.5%] left-[43%] h-[16%] w-[56%] flex items-center overflow-hidden">
        <h3 className="truncate font-finger-paint text-lg text-[#5C4A2E]">
          {project.title}
        </h3>
      </div>
      <p className="absolute top-[26%] left-[43%] h-[39%] w-[56%] overflow-hidden font-finger-paint text-xs text-[#5C4A2E]">
        {project.description}
      </p>
      {editable && !project.is_collaborator ? (
        <DeleteProjectButton
          action={deleteProjectAction}
          className="absolute bottom-[22%] left-[42%] w-[28%] py-1 cursor-pointer hover:zoom-110 transition-all font-finger-paint text-xl bg-[#F2B3AD] text-black/45 rounded-lg"
        />
      ) : (
        <button
          type="button"
          disabled
          className="absolute bottom-[22%] left-[42%] w-[28%] py-1 cursor-not-allowed opacity-60 font-finger-paint text-xl bg-[#F2B3AD] text-black/45 rounded-lg"
        >
          {project.is_collaborator ? "team wonder :3" : lockedLabel}
        </button>
      )}
      <Link
        href={`/dashboard/projects/edit/${project.id}`}
        className="absolute bottom-[22%] right-[0%] w-[28%] py-1 text-center cursor-pointer hover:zoom-110 transition-all font-finger-paint text-xl bg-[#D0E4B4] text-black/45 rounded-lg"
      >
        Edit :3
        <LinkPending className="rounded-lg bg-[#D0E4B4]">
          <span className="font-finger-paint text-xl text-black/45">
            opening...
          </span>
        </LinkPending>
      </Link>
      <span className="absolute bottom-[calc(12%+10px)] right-[2%] font-finger-paint text-[13px] text-[#7A6B4A]">
        {project.banned_at ? "banned :(" : STATUS_LABEL[project.status]}
      </span>
    </div>
  );
}
