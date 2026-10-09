/* eslint-disable @next/next/no-img-element */
const STEPS = [
  {
    img: "/step-1.png",
    title: "Make it",
    desc: "Find the wonder that could only come from you and build it. Hours don't matter here.",
    className: "bg-[#e8b4b4]/50",
  },
  {
    img: "/step-2.png",
    title: "Ship it",
    desc: "Hit ship and wait for our wonderful reviewers to take a look :3",
    className: "bg-[#a8c98a]/50",
  },
  {
    img: "/step-3.png",
    title: "Get your surprise",
    desc: "Read your reviewer's feedback and wait for your wonderful surprise :3",
    className: "bg-[#a3d9d3]/50",
  },
];

export function WonderSteps() {
  return (
    <div className="not-prose my-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {STEPS.map((step) => (
        <div key={step.title} className={`rounded-2xl p-4 ${step.className}`}>
          <img src={step.img} alt="" className="mx-auto h-28 w-auto object-contain" />
          <p className="mt-3 font-finger-paint text-xl text-[#16213e]">{step.title}</p>
          <p className="mt-1 text-sm text-[#16213e]/80">{step.desc}</p>
        </div>
      ))}
    </div>
  );
}
