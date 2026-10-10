/* eslint-disable @next/next/no-img-element */
const STEPS = [
  {
    img: "/step-1.png",
    title: "Think it",
    desc: "Find the wonder that could only come from you",
  },
  {
    img: "/step-2.png",
    title: "Build it",
    desc: "Build it. Hours don't matter here!",
  },
  {
    img: "/step-3.png",
    title: "Ship it and get your surprise",
    desc: "Hit ship and wait for your wonderful surprise :3",
  },
];

export function WonderSteps() {
  return (
    <div className="not-prose my-6 grid grid-cols-1">
      {STEPS.map((step) => (
        <div key={step.title} className="rounded-2xl p-4">
          <img src={step.img} alt="" className="mx-auto h-100 w-auto object-contain" />
          <p className="mt-3 font-finger-paint text-2xl text-[#16213e]">{step.title}</p>
          <p className="mt-1 text-[16px] text-[#16213e]/80">{step.desc}</p>
        </div>
      ))}
    </div>
  );
}
