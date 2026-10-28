/* eslint-disable @next/next/no-img-element */

interface ExploreProject {
  name: string;
  description: string;
  repo_url: string | null;
  demo_url: string | null;
  image_url?: string | null;
  tag: "draft" | "in_review" | "shipped";
}

const TAG: Record<ExploreProject["tag"], { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-[#A89C6C] text-[#2E2712]" },
  in_review: { label: "In review", className: "bg-[#F0E27D] text-[#16213E]" },
  shipped: { label: "Shipped", className: "bg-[#D0E4B4] text-[#2F4A1F]" },
};

export default function ExploreProjectCard({
  project,
  className = "w-full max-w-3xl",
}: {
  project: ExploreProject;
  className?: string;
}) {
  return (
    <>
      <div className={`hidden md:block ${className}`}>
        <WideCard project={project} />
      </div>
      <StackedCard project={project} />
    </>
  );
}

function StackedCard({ project }: { project: ExploreProject }) {
  return (
    <article className="flex flex-col gap-3 rounded-lg bg-[#D8D1AC] p-3 md:hidden">
      <img
        src={project.image_url || "/project-image-fallback.png"}
        alt=""
        className="aspect-video w-full rounded-md object-cover"
      />
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 wrap-break-word font-finger-paint text-xl text-[#5C4A2E]">{project.name}</h3>
        <span
          className={`shrink-0 rounded-full px-3 py-0.5 font-finger-paint text-sm ${TAG[project.tag].className}`}
        >
          {TAG[project.tag].label}
        </span>
      </div>
      <p className="line-clamp-4 font-poppins text-sm text-[#5C4A2E]">{project.description}</p>
      {(project.repo_url || project.demo_url) && (
        <div className="flex gap-3">
          {project.repo_url && (
            <a
              href={project.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-[#D0E4B4] py-1.5 text-center font-finger-paint text-lg text-black/45"
            >
              Repo :D
            </a>
          )}
          {project.demo_url && (
            <a
              href={project.demo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-[#F0E27D] py-1.5 text-center font-finger-paint text-lg text-black/45"
            >
              Demo :3
            </a>
          )}
        </div>
      )}
    </article>
  );
}

function WideCard({ project }: { project: ExploreProject }) {
  return (
    <div className="relative aspect-1327/345 overflow-hidden w-full">
      <img
        src="/project-template-base-with-inputs-1.png"
        alt=""
        className="absolute top-[-51.01%] left-[-25.62%] w-[144.69%] max-w-none"
      />
      <img
        src={project.image_url || "/project-image-fallback.png"}
        alt=""
        className="absolute top-[5%] left-[3%] h-[74%] w-[36%] rounded-md object-cover"
      />
      <span
        className={`absolute top-[6%] right-[2%] rounded-full px-3 py-0.5 font-finger-paint text-sm ${TAG[project.tag].className}`}
      >
        {TAG[project.tag].label}
      </span>
      <div className="absolute top-[5.5%] left-[43%] h-[16%] w-[38%] flex items-center overflow-hidden">
        <h3 className="truncate font-finger-paint text-lg text-[#5C4A2E]">
          {project.name}
        </h3>
      </div>
      <p className="absolute top-[26%] left-[43%] h-[39%] w-[56%] overflow-hidden font-poppins text-xs text-[#5C4A2E]">
        {project.description}
      </p>
      {project.repo_url && (
        <a
          href={project.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-[22%] left-[42%] w-[28%] py-1 text-center cursor-pointer hover:zoom-110 transition-all font-finger-paint text-xl bg-[#D0E4B4] text-black/45 rounded-lg"
        >
          Repo :D
        </a>
      )}
      {project.demo_url && (
        <a
          href={project.demo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-[22%] right-[0%] w-[28%] py-1 text-center cursor-pointer hover:zoom-110 transition-all font-finger-paint text-xl bg-[#F0E27D] text-black/45 rounded-lg"
        >
          Demo :3
        </a>
      )}
    </div>
  );
}
