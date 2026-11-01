/* eslint-disable @next/next/no-img-element */
import { REFERRALS_FOR_PIN } from "@/lib/referrals";

export default function PinHero({
  progress,
  left,
  pinSent,
}: {
  progress: number;
  left: number;
  pinSent: boolean;
}) {
  const status = pinSent
    ? "your pin is on its way :D"
    : left === 0
      ? "you did it! we'll send your pin soon :D"
      : `${left} more to go :3`;

  const pips = Array.from({ length: REFERRALS_FOR_PIN }, (_, i) => (
    <span
      key={i}
      className={`flex aspect-square w-9 items-center justify-center rounded-full border-2 font-finger-paint text-base @4xl:w-[clamp(1.6rem,3cqw,2.6rem)] @4xl:text-[clamp(.75rem,1.5cqw,1.1rem)] ${
        i < progress
          ? "border-[#4f7a3d] bg-[#86c77a] text-[#17301a]"
          : "border-dashed border-[#8C8368]/60 text-[#8C8368]"
      }`}
    >
      {i < progress ? "✓" : i + 1}
    </span>
  ));

  return (
    <section className="@container">
      <div className="relative hidden @4xl:block">
        <img src="/hc-pin-container.png" alt="" className="block h-auto w-full" />
        <div className="absolute inset-y-0 left-[33%] right-[10%] flex flex-col justify-center gap-[1.6cqw]">
          <h2 className="font-finger-paint text-[clamp(1.2rem,3.1cqw,2.1rem)] leading-tight text-[#5C4A2E]">
            bring {REFERRALS_FOR_PIN} friends, get a Hack Club pin
          </h2>
          <p className="font-finger-paint text-[clamp(.72rem,1.4cqw,1.05rem)] text-[#5C4A2E]/80">
            everyone you refer gets free stickers from us too. only brand new players with an ID verified by
            Hack Club count, and they can&apos;t already have a Wonders account.
          </p>
          <div className="flex items-center gap-[1cqw]">{pips}</div>
          <p className="font-finger-paint text-[clamp(.85rem,1.7cqw,1.2rem)] text-[#5C4A2E]">{status}</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-[#8C8368]/30 bg-[#E7E2C9] p-5 text-center @4xl:hidden">
        <img src="/hc-pin.png" alt="Hack Club enamel pin" className="w-56 -rotate-6" />
        <h2 className="font-finger-paint text-2xl text-[#5C4A2E]">
          bring {REFERRALS_FOR_PIN} friends, get a Hack Club pin
        </h2>
        <p className="font-finger-paint text-sm text-[#5C4A2E]/80">
          everyone you refer gets free stickers from us too. only brand new players with an ID verified by
          Hack Club count, and they can&apos;t already have a Wonders account.
        </p>
        <div className="flex items-center gap-2">{pips}</div>
        <p className="font-finger-paint text-lg text-[#5C4A2E]">{status}</p>
      </div>
    </section>
  );
}
