/* eslint-disable @next/next/no-img-element */

interface ExploreProject {
  name: string;
  description: string;
  repo_url: string | null;
  demo_url: string | null;
}

interface Player {
  slack_name: string;
  slack_id: string;
  email: string;
  projects: ExploreProject[];
}

export default function ExplorePlayerCard({ player }: { player: Player }) {
  return (
    <div className="relative h-90 w-90 shrink-0">
      <img
        src="/project-template-base-with-inputs.png"
        alt=""
        className="absolute inset-0 h-full w-full"
      />
      {/* <div className="absolute top-[31%] left-[14%] right-[6%] h-[11%] flex items-center overflow-hidden">
        <h3 className="truncate font-finger-paint text-lg text-[#5C4A2E]">
          {player.slack_name}
        </h3>
      </div> */}
      <p className="absolute top-[54%] left-[14%] right-[6%] h-[10%] overflow-hidden font-poppins text-xs text-[#5C4A2E]">
        {player.email}
      </p>
      <div className="absolute bottom-[28%] left-[14%] right-[6%] flex flex-wrap gap-1">
        {player.projects.map((proj, i) => (
          <span
            key={i}
            className="rounded-full bg-[#5C4A2E]/10 px-2 py-0.5 font-poppins text-[10px] text-[#5C4A2E] w-[95%]"
          >
            {proj.name}
          </span>
        ))}
        {player.projects.length === 0 && (
          <span className="font-poppins text-[10px] text-[#5C4A2E]/50">
            no projects yet
          </span>
        )}
      </div>
    </div>
  );
}
