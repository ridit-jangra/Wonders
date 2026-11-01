/* eslint-disable @next/next/no-img-element */
export default function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`@container relative rounded-lg bg-[#D7CFAC] px-5 pb-24 pt-5 md:px-7 md:pt-7 ${className}`}>
      <img
        src="/container-note.png"
        alt=""
        className="pointer-events-none absolute right-[3%] top-3 w-[clamp(190px,21cqw,400px)]"
      />
      <img
        src="/container-cat.png"
        alt=""
        className="pointer-events-none absolute bottom-3 right-[2.5%] w-[clamp(72px,8cqw,140px)]"
      />
      <div className="relative">{children}</div>
    </section>
  );
}
