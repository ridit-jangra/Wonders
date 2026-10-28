/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative min-h-svh w-full overflow-hidden">
      <img
        className="fixed inset-0 -z-20 h-full w-full object-cover"
        src="/bg-effect-4.png"
        alt=""
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-contain bg-center bg-no-repeat md:bg-cover"
        style={{ backgroundImage: "url('/cliff-with-guy.png')" }}
      />
      <div className="flex min-h-svh flex-col items-start gap-4 px-6 pt-[5svh] sm:px-10 md:ml-auto md:w-[55%] md:items-end md:justify-center md:pt-0 md:pr-[26%] md:pl-0 md:text-right">
        <h1 className="font-finger-paint text-6xl leading-none text-[#5C4A2E] sm:text-7xl md:text-7xl lg:text-8xl">
          404
          <br />
          not found
        </h1>
        <p className="max-w-md font-finger-paint text-lg text-[#5C4A2E]/70 sm:text-xl">
          this page wandered off the cliff, let&apos;s get you back :3
        </p>
        <Link href="/" className="group relative mt-2 block">
          <img
            src="/button-template-3.png"
            alt=""
            className="h-auto w-64 transition-all group-hover:w-68"
          />
          <span className="absolute inset-0 flex items-center justify-center font-finger-paint text-2xl tracking-wide text-[#16213E]">
            Take me home :3
          </span>
        </Link>
      </div>
    </div>
  );
}
