/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { getProfile } from "@/lib/profiles";
import { createProject } from "@/lib/projects";
import { uploadThumbnail } from "@/lib/storage";
import ThumbnailPicker from "@/app/dashboard/components/ThumbnailPicker";
import SubmitButton from "@/app/dashboard/components/SubmitButton";
import Link from "next/link";

const ALLOWED_REDIRECTS = ["/dashboard", "/wonders"];

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_to?: string }>;
}) {
  const { redirect_to } = await searchParams;
  const redirectTo = ALLOWED_REDIRECTS.includes(redirect_to ?? "")
    ? (redirect_to as string)
    : "/dashboard";

  const cookieStore = await cookies();
  const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/login");
  }

  async function submitProject(formData: FormData) {
    "use server";

    const store = await cookies();
    const current = verifySessionCookie(store.get(SESSION_COOKIE)?.value);
    if (!current) {
      redirect("/login");
    }

    const profile = await getProfile(current.slackId);
    if (!profile) {
      redirect("/onboarding");
    }

    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const githubUrl = String(formData.get("github-repo-url") ?? "").trim();
    const demoUrl = String(formData.get("demo-url") ?? "").trim();
    const thumbnail = formData.get("thumbnail");
    if (!title || !description) {
      return;
    }

    const imageUrl =
      thumbnail instanceof File && thumbnail.size > 0
        ? await uploadThumbnail(thumbnail, profile.id)
        : null;

    await createProject(profile.id, {
      title,
      description,
      link_url: demoUrl,
      github_url: githubUrl,
      image_url: imageUrl,
    });
    redirect(redirectTo);
  }

  return (
    <div className="relative flex min-h-screen flex-col gap-6 bg-[#F0EBD1] px-6 pt-24 pb-10 sm:px-10 md:bg-transparent md:px-14 md:py-16 lg:py-28">
      <img
        src="/new-or-edit-projects-template.png"
        alt=""
        className="fixed top-0 right-[12%] bottom-[14%] left-[7.5%] -z-10 hidden h-full w-full object-contain md:block"
      />
      <h1 className="font-finger-paint text-3xl text-[#5C4A2E] sm:text-4xl lg:text-5xl">
        Create your Wonder
      </h1>
      <form
        action={submitProject}
        className="flex w-full flex-col gap-4 md:max-w-[84%]"
      >
        <p className="font-finger-paint text-[#5C4A2E]/70">
          Give your wonder a name :3
        </p>
        <input
          name="title"
          required
          placeholder="give it a name"
          className="w-full border border-[#8C8368]/30 bg-[#E7E2C9] px-4 py-3 font-finger-paint text-base text-[#5C4A2E] placeholder:text-[#8C8368] focus:border-[#8C8368] focus:outline-none md:border-0"
        />
        <p className="font-finger-paint text-[#5C4A2E]/70">
          Give your wonder a description :3
        </p>
        <textarea
          name="description"
          required
          placeholder="what is it? why does it feel like you?"
          rows={5}
          className="w-full font-finger-paint resize-none border border-[#8C8368]/30 bg-[#E7E2C9] px-4 py-3 text-base text-[#5C4A2E] placeholder:text-[#8C8368] focus:border-[#8C8368] focus:outline-none md:border-0"
        />
        <p className="font-finger-paint text-[#5C4A2E]/70">
          Give your wonder a thumbnail :3
        </p>
        <ThumbnailPicker />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex w-full flex-col gap-2">
            <p className="font-finger-paint text-[#5C4A2E]/70">
              Github repo url :D
            </p>
            <input
              name="github-repo-url"
              placeholder="https://"
              className="w-full border border-[#8C8368]/30 bg-[#E7E2C9] px-4 py-3 font-finger-paint text-base text-[#5C4A2E] placeholder:text-[#8C8368] focus:border-[#8C8368] focus:outline-none md:border-0"
            />
          </span>
          <span className="flex w-full flex-col gap-2">
            <p className="font-finger-paint text-[#5C4A2E]/70">Demo url :D</p>
            <input
              name="demo-url"
              placeholder="https://"
              className="w-full border border-[#8C8368]/30 bg-[#E7E2C9] px-4 py-3 font-finger-paint text-base text-[#5C4A2E] placeholder:text-[#8C8368] focus:border-[#8C8368] focus:outline-none md:border-0"
            />
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:justify-end">
          <Link
            href={redirectTo}
            className="w-full rounded-md bg-[#F2B3AD] px-4 py-2 text-center font-finger-paint text-lg text-black/40 hover:zoom-110 transition-all sm:w-48"
          >
            Cancel :(
          </Link>
          <SubmitButton
            pendingLabel="creating it... :3"
            className="w-full rounded-md bg-[#D1E4B5] px-4 py-2 font-finger-paint text-lg text-black/40 hover:zoom-110 transition-all sm:w-48"
          >
            Create it :3
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
