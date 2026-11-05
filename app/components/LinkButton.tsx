"use client";

export default function LinkButton({
  href,
  newTab = false,
  className = "",
  children,
}: {
  href: string;
  newTab?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`inline-block underline hover:zoom-110 transition-all ${className}`}
      onClick={() => {
        if (newTab) window.open(href, "_blank", "noopener,noreferrer");
        else window.location.assign(href);
      }}
    >
      {children}
    </button>
  );
}
