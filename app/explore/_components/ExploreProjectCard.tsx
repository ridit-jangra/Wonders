/* eslint-disable @next/next/no-img-element */

interface ExploreProject {
  name: string;
  description: string;
  repo_url: string | null;
  demo_url: string | null;
}

export default function ExploreProjectCard({
  project,
  className = "w-full max-w-3xl",
}: {
  project: ExploreProject;
  className?: string;
}) {
  return (
    <div className={`relative aspect-1327/345 overflow-hidden ${className}`}>
      <img
        src="/project-template-base-with-inputs-1.png"
        alt=""
        className="absolute top-[-51.01%] left-[-25.62%] w-[144.69%] max-w-none"
      />
      <img
        src="/project-image-fallback.png"
        alt=""
        className="absolute top-[5%] left-[3%] h-[74%] w-[36%] rounded-md object-cover"
      />
      <div className="absolute top-[5.5%] left-[43%] h-[16%] w-[56%] flex items-center overflow-hidden">
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
