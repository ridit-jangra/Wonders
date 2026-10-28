/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../../dashboard/components/Sidebar";
import ExploreProjectCard from "./ExploreProjectCard";
import ExplorePlayerCard from "./ExplorePlayerCard";

interface Project {
  name: string;
  description: string;
  repo_url: string | null;
  demo_url: string | null;
  tag: "draft" | "in_review" | "shipped";
}

type Tab = "wonders";

export default function ExploreClient({ loggedIn }: { loggedIn: boolean }) {
  const [tab, setTab] = useState<Tab>("wonders");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url =
      tab === "wonders" ? "/api/public/wonders" : "";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (tab === "wonders") setProjects(data.projects ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="relative flex min-h-screen">
      <img
        className="fixed inset-0 -z-10 h-full w-full object-cover"
        src="/bg-effect-4.png"
        alt=""
      />
      {loggedIn && <Sidebar />}
      <main
        className={`relative min-w-0 flex-1 pr-6 md:pr-10 md:pt-10 ${loggedIn ? "pt-20 pl-6 md:pl-0" : "pt-10 pl-6 md:pl-10"}`}
      >
        <h1 className="font-finger-paint text-4xl text-[#BFD8A8]">Explore</h1>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setTab("wonders")}
            className={`rounded-full px-5 py-2 cursor-pointer font-finger-paint text-lg transition-colors ${
              tab === "wonders"
                ? "bg-[#F0E27D] text-[#16213E]"
                : "bg-[#D1E4B5]/60 text-[#5C4A2E] hover:bg-[#D1E4B5]/80"
            }`}
          >
            Wonders
          </button>
        </div>

        <div className="mt-8">
          {loading && (
            <div className="flex justify-center py-16">
              <img src="/loader.gif" alt="loading..." className="w-80" />
            </div>
          )}

          {!loading && tab === "wonders" && (
            <div className="mt-2 flex flex-col items-stretch gap-3">
              {projects.map((p, i) => (
                <ExploreProjectCard
                  project={p}
                  key={i}
                  className="w-full"
                />
              ))}
              {projects.length === 0 && (
                <div className="flex min-h-[55vh] w-full flex-col items-center justify-center gap-6 py-10 text-center">
                  <h2 className="mb-3 font-finger-paint text-5xl leading-none text-balance text-[#5C4A2E] sm:text-7xl lg:text-8xl">
                    no projects
                    <br />
                    yet
                  </h2>
                  <p className="max-w-md font-finger-paint text-lg text-[#5C4A2E]/70 sm:text-xl">
                    nobody has started a wonder yet, be the first :3
                  </p>
                  <Link
                    href={loggedIn ? "/dashboard/projects/new?redirect_to=%2Fexplore" : "/login"}
                    className="group relative mt-2 block"
                  >
                    <img
                      src="/button-template-3.png"
                      alt=""
                      className="h-auto w-64 transition-all group-hover:w-68"
                    />
                    <span className="absolute inset-0 flex items-center justify-center font-finger-paint text-2xl tracking-wide text-[#16213E]">
                      {loggedIn ? "Make a wonder :3" : "Log in to start :3"}
                    </span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
