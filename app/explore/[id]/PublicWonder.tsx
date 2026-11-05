/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import Sidebar from "@/app/dashboard/components/Sidebar";
import { Profile } from "@/app/dashboard/components/Profile";
import TopBlur from "@/app/dashboard/components/TopBlur";
import type { ExploreWonder } from "@/lib/share";

const TAG: Record<ExploreWonder["tag"], string> = {
  draft: "building :)",
  in_review: "in review :3",
  shipped: "shipped :D",
};

const BUTTON =
  "w-full rounded-md px-5 py-2 text-center font-finger-paint text-lg text-black/50 transition-all hover:zoom-110 sm:w-auto";

export default function PublicWonder({
  wonder,
  loggedIn,
  showRefers,
}: {
  wonder: ExploreWonder;
  loggedIn: boolean;
  showRefers: boolean;
}) {
  const content = (
    <>
      <Link href="/explore" className="font-finger-paint text-lg text-[#5C4A2E]/70 hover:underline">
        &lt; back to explore
      </Link>

      <article className="flex flex-col gap-4">
        <img
          src={wonder.image_url || "/project-image-fallback.png"}
          alt=""
          className="aspect-video w-full rounded-md object-cover"
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 wrap-break-word font-finger-paint text-3xl text-[#5C4A2E]">{wonder.title}</h1>
          <span className="rounded-full bg-[#E7E2C9] px-3 py-1 font-finger-paint text-sm text-[#7A6B4A]">
            {TAG[wonder.tag]}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-md bg-[#E7E2C9] p-3 font-finger-paint text-sm text-[#5C4A2E]">
          <span>by</span>
          {wonder.makers.map((maker, index) => (
            <span key={index} className="flex items-center gap-2">
              {maker.avatarUrl && <img src={maker.avatarUrl} alt="" className="h-6 w-6 rounded-full" />}
              {maker.name}
            </span>
          ))}
        </div>

        <p className="whitespace-pre-wrap wrap-break-word rounded-md bg-[#E7E2C9] p-3 font-finger-paint text-[#5C4A2E]">
          {wonder.description}
        </p>

        {(wonder.github_url || wonder.link_url) && (
          <div className="flex flex-col gap-3 sm:flex-row">
            {wonder.github_url && (
              <a
                href={wonder.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${BUTTON} bg-[#D0E4B4]`}
              >
                Repo :D
              </a>
            )}
            {wonder.link_url && (
              <a
                href={wonder.link_url}
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

    </>
  );

  return (
    <div className="relative flex min-h-screen">
      <img className="fixed inset-0 -z-10 h-full w-full object-cover" src="/bg-effect-4.png" alt="" />
      <div className="pointer-events-none fixed top-0 right-[2%] bottom-0 left-0 -z-10 hidden md:left-[calc(100vh*554/1080-10vh)] md:block">
        <img src="/new-or-edit-projects-template.png" alt="" className="h-full w-full object-fill" />
      </div>
      <TopBlur />
      <Sidebar showRefers={showRefers} loggedOut={!loggedIn} />
      <main className="relative min-w-0 flex-1 bg-[#F0EBD1] px-6 pb-10 pt-24 sm:px-10 md:bg-transparent md:py-16 md:pl-4 md:pr-14 lg:py-24">
        <div className="flex w-full flex-col gap-5 md:max-w-[90%]">{content}</div>
      </main>
      {loggedIn && <Profile />}
    </div>
  );
}
