/* eslint-disable @next/next/no-img-element */

interface Step {
  img: string;
  underline: string;
  title: string;
  desc: string;
}

export function HowThisWorks() {
  const steps: Step[] = [
    {
      img: "/step-1.png",
      underline: "decoration-[#ec3750]",
      title: "Find the wonder that could only come from you",
      desc: "Make it!!!! don't care how many hours you farm, HOURS do not MATTER here",
    },
    {
      img: "/step-2.png",
      underline: "decoration-[#33a853]",
      title: "Ship it!!!!",
      desc: "and WAIT for your WONDERFUL project to get REVIEWED by our wonderful reviewers :3",
    },
    {
      img: "/step-3.png",
      underline: "decoration-[#338eda]",
      title: "Get your wonderful reviewer feedback",
      desc: "and wait for your wonderful surprise :3",
    },
  ];

  return (
    <div className="relative w-full min-h-[100svh] bg-white overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: "url('/bg-effect-2.png')" }}
      />
      {/* <div
        className="absolute inset-0 bg-cover bg-center z-10"
        style={{ backgroundImage: "url('/bg-part-4.png')" }}
      /> */}

      <div className="relative z-20 flex flex-col items-center justify-center min-h-[100svh] py-12">
        <div className="pt-8 md:pt-20 px-6">
          <img
            src="/how-this-works.png"
            alt="How this works!"
            className="h-auto w-full max-w-150 object-contain"
          />
        </div>

        <div className="grid w-full grid-cols-1 gap-8 px-8 md:grid-cols-3 md:grid-rows-[auto_auto_1fr]">
          {steps.map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center rounded-xl p-4 text-center md:row-span-3 md:grid md:grid-rows-subgrid md:gap-0"
            >
              <img
                src={s.img}
                alt={s.title}
                className="h-auto w-full max-w-130 self-end rounded-lg object-contain"
              />
              <p className={`mt-4 font-poppins text-lg font-bold text-[#5C4A2E] underline decoration-wavy decoration-from-font underline-offset-4 ${s.underline}`}>
                {s.title}
              </p>
              <p className="mt-3 self-start px-4 font-poppins font-medium text-black">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
