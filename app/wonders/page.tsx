/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { getSessionProfile } from "@/lib/profiles";
import { canUseReferrals } from "@/lib/referrals";
import { getProjects } from "@/lib/projects";
import Sidebar from "@/app/dashboard/components/Sidebar";
import { Profile } from "@/app/dashboard/components/Profile";
import ProjectCard from "@/app/dashboard/components/ProjectCard";
import AddProjectCard from "@/app/dashboard/components/AddProjectCard";
import ProjectCardWide from "@/app/dashboard/components/ProjectCardWide";
import AddProjectCardWide from "@/app/dashboard/components/AddProjectCardWide";
import JoinWonderButton from "@/app/dashboard/components/JoinWonderButton";

export default async function ProjectsPage() {
  const cookieStore = await cookies();
  const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    redirect("/login");
  }

  const profile = await getSessionProfile(session);
  if (!profile?.interest) {
    redirect("/onboarding");
  }

  const projects = await getProjects(profile.id);

  return (
    <div className="relative flex min-h-screen">
      <img
        className="fixed inset-0 -z-10 h-full w-full object-cover"
        src="/bg-effect-4.png"
        alt=""
      />
      <Sidebar showRefers={await canUseReferrals(profile.slack_id)} />
      <Profile />
      <main className="relative min-w-0 flex-1 pr-6 pt-20 md:pr-10 md:pt-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-finger-paint text-4xl text-[#BFD8A8]">
            Your Wonders
          </h1>
          <JoinWonderButton className="mr-0 rounded-lg bg-[#A8C7E0] px-4 py-2 font-finger-paint text-lg text-black/50 transition-all hover:zoom-110 md:mr-36" />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 md:hidden">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              size="aspect-square w-full"
            />
          ))}
          <AddProjectCard size="aspect-square w-full" redirectTo="/wonders" />
        </div>

        <div className="mt-8 hidden flex-col items-stretch gap-3 md:flex">
          {projects.map((project) => (
            <ProjectCardWide
              key={project.id}
              project={project}
              className="w-full"
            />
          ))}
          <AddProjectCardWide
            className="w-full"
            redirectTo="/wonders"
          />
        </div>
      </main>
    </div>
  );
}
