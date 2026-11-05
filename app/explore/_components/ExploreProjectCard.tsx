/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

interface ExploreProject {
  name: string;
  description: string;
  repo_url: string | null;
  demo_url: string | null;
  image_url?: string | null;
  tag: "draft" | "in_review" | "shipped";
  label?: string;
}

const TAG: Record<ExploreProject["tag"], string> = {
  draft: "building :)",
  in_review: "in review :3",
  shipped: "shipped :D",
};

export default function ExploreProjectCard({
  project,
  className = "w-full max-w-3xl",
  href,
}: {
  project: ExploreProject;
  className?: string;
  href?: string;
}) {
  return (
    <div className="relative">
      {href && (
        <Link
          href={href}
          aria-label={`open ${project.name}`}
          className="absolute inset-0 z-5 rounded-lg"
        />
      )}
      <div className={`hidden md:block ${className}`}>
        <WideCard project={project} />
      </div>
      <StackedCard project={project} />
    </div>
  );
}

function tagText(project: ExploreProject) {
  return project.label ?? TAG[project.tag];
}

function StackedCard({ project }: { project: ExploreProject }) {
  return (
    <article className="flex flex-col gap-3 md:hidden">
      <div className="relative aspect-square w-full">
        <img
          src="/project-template-base-with-inputs.png"
          alt=""
          className="absolute inset-0 h-full w-full"
        />
        <img
          src={project.image_url || "/project-image-fallback.png"}
          alt=""
          className="absolute top-[6%] left-[12%] right-[8%] h-[40%] w-[80%] rounded-md object-cover"
        />
        <div className="absolute top-[51%] left-[14%] right-[6%] flex h-[11%] items-center overflow-hidden">
          <h3 className="truncate font-finger-paint text-lg text-[#5C4A2E]">{project.name}</h3>
        </div>
        <p className="absolute top-[66%] left-[14%] right-[6%] h-[24%] overflow-hidden font-finger-paint text-xs text-[#5C4A2E]">
          {project.description}
        </p>
        <span className="absolute bottom-[5%] right-[9%] font-finger-paint text-[10px] text-[#7A6B4A]">
          {tagText(project)}
        </span>
      </div>
      {(project.repo_url || project.demo_url) && (
        <div className="flex gap-3 px-1">
          {project.repo_url && (
            <a
              href={project.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 flex-1 rounded-lg bg-[#D0E4B4] py-1.5 text-center font-finger-paint text-lg text-black/45 transition-all hover:zoom-110"
            >
              Repo :D
            </a>
          )}
          {project.demo_url && (
            <a
              href={project.demo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 flex-1 rounded-lg bg-[#F0E27D] py-1.5 text-center font-finger-paint text-lg text-black/45 transition-all hover:zoom-110"
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
      <span className="absolute bottom-[12%] right-[2%] font-finger-paint text-[13px] text-[#7A6B4A]">
        {tagText(project)}
      </span>
      <div className="absolute top-[5.5%] left-[43%] h-[16%] w-[38%] flex items-center overflow-hidden">
        <h3 className="truncate font-finger-paint text-lg text-[#5C4A2E]">
          {project.name}
        </h3>
      </div>
      <p className="absolute top-[26%] left-[43%] h-[39%] w-[56%] overflow-hidden font-finger-paint text-xs text-[#5C4A2E]">
        {project.description}
      </p>
      {project.repo_url && (
        <a
          href={project.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute z-10 bottom-[22%] left-[42%] w-[28%] py-1 text-center cursor-pointer hover:zoom-110 transition-all font-finger-paint text-xl bg-[#D0E4B4] text-black/45 rounded-lg"
        >
          Repo :D
        </a>
      )}
      {project.demo_url && (
        <a
          href={project.demo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute z-10 bottom-[22%] right-[0%] w-[28%] py-1 text-center cursor-pointer hover:zoom-110 transition-all font-finger-paint text-xl bg-[#F0E27D] text-black/45 rounded-lg"
        >
          Demo :3
        </a>
      )}
    </div>
  );
}
