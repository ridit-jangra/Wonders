/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../../dashboard/components/Sidebar";
import ExploreProjectCard from "./ExploreProjectCard";
import ExplorePlayerCard from "./ExplorePlayerCard";

interface Project {
  id?: number;
  label?: string;
  name: string;
  description: string;
  repo_url: string | null;
  demo_url: string | null;
  image_url?: string | null;
  tag: "draft" | "in_review" | "shipped";
}

type Tab = "wonders";

interface AdminWonder {
  id: number;
  title: string;
  description: string;
  github_url: string | null;
  link_url: string | null;
  image_url: string | null;
  status: string;
  banned_at: string | null;
  owner_name: string;
  owner_slack_id: string;
  owner_slack_name: string | null;
}

function adminTag(status: string): Project["tag"] {
  if (status === "shipped" || status === "fulfillment_started" || status === "fulfilled") return "shipped";
  if (status === "in_review" || status === "second_pass" || status === "approved") return "in_review";
  return "draft";
}

export default function ExploreClient({
  loggedIn,
  showRefers = false,
  isAdmin = false,
}: {
  loggedIn: boolean;
  showRefers?: boolean;
  isAdmin?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("wonders");
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const adminQuery = isAdmin ? query : "";
  const needle = query.trim().toLowerCase();
  const visible = isAdmin || !needle ? projects : projects.filter((p) => p.name.toLowerCase().includes(needle));

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    const delay = isAdmin ? 250 : 0;
    const timer = setTimeout(() => {
      const url = isAdmin ? `/api/admin/explore?q=${encodeURIComponent(adminQuery)}` : "/api/public/wonders";
      fetch(url, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          if (isAdmin) {
            const wonders: AdminWonder[] = data.wonders ?? [];
            setProjects(
              wonders.map((w) => ({
                id: w.id,
                name: w.title,
                description: w.description,
                repo_url: w.github_url,
                demo_url: w.link_url,
                image_url: w.image_url,
                tag: adminTag(w.status),
                label: `${w.banned_at ? "banned :( · " : ""}${w.owner_slack_name || w.owner_name || w.owner_slack_id}`,
              })),
            );
          } else {
            setProjects(data.projects ?? []);
          }
        })
        .catch((err) => {
          if (err?.name !== "AbortError") console.error(err);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tab, isAdmin, adminQuery]);

  return (
    <div className="relative flex min-h-screen">
      <img
        className="fixed inset-0 -z-10 h-full w-full object-cover"
        src="/bg-effect-4.png"
        alt=""
      />
      {loggedIn && <Sidebar showRefers={showRefers} />}
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

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            isAdmin
              ? "search by title, slack id, name, email, repo, demo or #id"
              : "search wonders by name"
          }
          maxLength={100}
          className="mt-6 w-full rounded-md bg-[#E7E2C9] px-4 py-3 font-finger-paint text-base text-[#5C4A2E] placeholder:text-[#8C8368] focus:outline-none"
        />

        <div className="mt-8">
          {loading && (
            <div className="flex justify-center py-16">
              <img src="/loader.gif" alt="loading..." className="w-80" />
            </div>
          )}

          {!loading && tab === "wonders" && (
            <div className="mt-2 flex flex-col items-stretch gap-3">
              {visible.map((p, i) => (
                <ExploreProjectCard
                  project={p}
                  key={p.id ?? i}
                  className="w-full"
                  href={p.id ? `/explore/${p.id}` : undefined}
                />
              ))}
              {visible.length === 0 && needle && (
                <p className="py-10 text-center font-finger-paint text-xl text-[#5C4A2E]/70">
                  no wonders match that :(
                </p>
              )}
              {visible.length === 0 && !needle && (
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
