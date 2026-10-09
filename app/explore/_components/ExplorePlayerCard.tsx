/* eslint-disable @next/next/no-img-element */

interface ExploreProject {
  name: string;
  description: string;
  repo_url: string | null;
  demo_url: string | null;
}

interface Player {
  slack_id: string;
  slack_name: string | null;
  avatar_url: string | null;
  joined_at: string;
  wonder_count: number;
  wonders: ExploreProject[];
}

export default function ExplorePlayerCard({ player }: { player: Player }) {
  return (
    <div className="relative h-90 w-90 shrink-0">
      <img
        src="/project-template-base-with-inputs.png"
        alt=""
        className="absolute inset-0 h-full w-full"
      />
      <p className="absolute top-[54%] left-[14%] right-[6%] h-[10%] overflow-hidden font-poppins text-xs text-[#5C4A2E]">
        {player.slack_name ?? player.slack_id} · {player.wonder_count} wonders
      </p>
      <div className="absolute bottom-[28%] left-[14%] right-[6%] flex flex-wrap gap-1">
        {player.wonders.map((proj, i) => (
          <span
            key={i}
            className="rounded-full bg-[#5C4A2E]/10 px-2 py-0.5 font-poppins text-[10px] text-[#5C4A2E] w-[95%]"
          >
            {proj.name}
          </span>
        ))}
        {player.wonders.length === 0 && (
          <span className="font-poppins text-[10px] text-[#5C4A2E]/50">
            no projects yet
          </span>
        )}
      </div>
    </div>
  );
}
