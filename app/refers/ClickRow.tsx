/* eslint-disable @next/next/no-img-element */
import LocalTime from "@/app/dashboard/components/LocalTime";

export default function ClickRow({ at }: { at: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-[#E7E2C9] p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#8C8368]/30">
        <img src="/ghost-pfp.png" alt="" className="h-full w-full object-contain" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-finger-paint text-base text-[#5C4A2E]">someone opened your link</p>
        <p className="font-finger-paint text-xs text-[#5C4A2E]/60">
          <LocalTime iso={at} />
        </p>
      </div>
      <span className="rounded-full bg-[#8C8368]/25 px-3 py-1 font-finger-paint text-xs text-[#5C4A2E]">click</span>
    </div>
  );
}
