/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { getSessionProfile } from "@/lib/profiles";
import { getProjects } from "@/lib/projects";
import ProjectCard from "./components/ProjectCard";
import AddProjectCardWide from "./components/AddProjectCardWide";

export default async function DashPage() {
  const cookieStore = await cookies();
  const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    redirect("/login");
  }

  const profile = await getSessionProfile(session);
  if (!profile) {
    redirect("/onboarding");
  }

  const projects = await getProjects(profile.id);

  return (
    <div className="flex min-h-screen w-full flex-col px-6 pt-20 md:px-10 md:pt-10">
      <img
        src="/hi-welcome.png"
        alt="hi, welcome"
        className="h-auto w-full max-w-120 lg:max-w-88"
      />
      <h1 className="font-finger-paint wrap-break-word text-5xl lg:text-4xl text-[#D9D3AF]">
        {session.name || session.email}
      </h1>
      <div className="flex w-fit max-w-full flex-col gap-5 pt-6 lg:pt-8">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <h1 className="text-[#BFD8A8] font-finger-paint text-4xl">Wonders</h1>
          <Link
            href="/wonders"
            className="font-finger-paint text-lg text-[#F2B3AD] hover:underline"
          >
            go to /wonders to see all &gt;
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[repeat(2,minmax(0,22.5rem))] lg:grid-cols-[repeat(3,minmax(0,max(13rem,min(22.5rem,calc((100vh-20rem)/1.78)))))]">
          {projects.slice(0, 3).map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              size="aspect-square w-full"
            />
          ))}
          <div className="col-span-full">
            <AddProjectCardWide className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
