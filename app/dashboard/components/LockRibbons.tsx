/* eslint-disable @next/next/no-img-element */
export default function LockRibbons({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 z-10 overflow-hidden ${className}`}>
      <img
        src="/arrows.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
    </div>
  );
}
