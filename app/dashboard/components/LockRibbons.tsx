/* eslint-disable @next/next/no-img-element */
const SRC = "/locked-rainbow-thin.png";

export default function LockRibbons() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <img
        src={SRC}
        alt=""
        className="absolute inset-0 h-full w-full object-fill drop-shadow-[0_6px_10px_rgba(0,0,0,0.18)]"
      />
      <img
        src={SRC}
        alt=""
        className="absolute inset-0 h-full w-full -scale-x-100 object-fill drop-shadow-[0_6px_10px_rgba(0,0,0,0.18)]"
      />
    </div>
  );
}
