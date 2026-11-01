export default function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`border border-[#8C8368]/30 bg-[#E7E2C9] px-4 py-4 md:border-0 md:px-6 md:py-6 ${className}`}
    >
      {children}
    </section>
  );
}
