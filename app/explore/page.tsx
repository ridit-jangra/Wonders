/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Sidebar from "../dashboard/components/Sidebar";
import ExploreProjectCard from "./_components/ExploreProjectCard";
import ExplorePlayerCard from "./_components/ExplorePlayerCard";

interface Project {
  name: string;
  description: string;
  repo_url: string | null;
  demo_url: string | null;
}

interface Player {
  slack_name: string;
  slack_id: string;
  email: string;
  projects: Project[];
}

type Tab = "wonders" | "players";

export default function ExplorePage() {
  const [tab, setTab] = useState<Tab>("wonders");
  const [projects, setProjects] = useState<Project[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url =
      tab === "wonders" ? "/api/public/wonders" : "/api/public/players";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (tab === "wonders") setProjects(data.projects ?? []);
        else setPlayers(data.players ?? []);
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
      <Sidebar />
      <main className="relative min-w-0 flex-1 pr-6 pt-20 md:pr-10 md:pt-10">
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
          <button
            onClick={() => setTab("players")}
            className={`rounded-full px-5 py-2 cursor-pointer font-finger-paint text-lg transition-colors ${
              tab === "players"
                ? "bg-[#F0E27D] text-[#16213E]"
                : "bg-[#D1E4B5]/60 text-[#5C4A2E] hover:bg-[#D1E4B5]/80"
            }`}
          >
            Players
          </button>
        </div>

        <div className="mt-8">
          {loading && (
            <div className="flex justify-center py-16">
              <img src="/loader.gif" alt="loading..." className="w-80" />
            </div>
          )}

          {!loading && tab === "wonders" && (
            <div className="mt-2 flex flex-col items-start gap-3">
              {projects.map((p, i) => (
                <ExploreProjectCard
                  project={p}
                  key={i}
                  className="w-full max-w-6xl"
                />
              ))}
              {projects.length === 0 && (
                <p className="font-poppins text-[#BFD8A8]/60">
                  no projects yet
                </p>
              )}
            </div>
          )}

          {!loading && tab === "players" && (
            <div className="grid grid-cols-1 gap-[48vh] sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {players.map((p) => (
                <ExplorePlayerCard key={p.slack_id} player={p} />
              ))}
              {players.length === 0 && (
                <p className="font-poppins text-[#BFD8A8]/60">no players yet</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
