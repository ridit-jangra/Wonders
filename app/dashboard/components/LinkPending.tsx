/* eslint-disable @next/next/no-img-element */
"use client";

import { useLinkStatus } from "next/link";

/**
 * Covers its <Link> while the navigation is in flight. `useLinkStatus` reports
 * the status of the nearest parent Link, so this has to render inside one.
 * The parent Link needs to be positioned for `inset-0` to land correctly.
 */
export default function LinkPending({
  className = "bg-[#F0EBD1]/75",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <span
      aria-live="polite"
      className={`absolute inset-0 z-10 flex items-center justify-center ${className}`}
    >
      {children ?? (
        <img src="/loader.gif" alt="loading..." className="w-1/2 max-w-40" />
      )}
    </span>
  );
}
