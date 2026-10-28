"use client";

import { Children, useState, type ReactNode } from "react";

export default function PageList({
  children,
  pageSize = 5,
  startAtEnd = false,
  as: Tag = "ol",
  className = "flex flex-col gap-2",
}: {
  children: ReactNode;
  pageSize?: number;
  startAtEnd?: boolean;
  as?: "ol" | "div";
  className?: string;
}) {
  const items = Children.toArray(children);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const [chosen, setChosen] = useState<number | null>(null);
  const page = Math.min(chosen ?? (startAtEnd ? pages - 1 : 0), pages - 1);
  const visible = items.slice(page * pageSize, page * pageSize + pageSize);

  const button =
    "rounded-md bg-[#E7E2C9] px-3 py-1 font-finger-paint text-sm text-[#5C4A2E] transition-all hover:zoom-110 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <>
      <Tag className={className}>{visible}</Tag>
      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="pages">
          <button type="button" className={button} disabled={page === 0} onClick={() => setChosen(page - 1)}>
            &lt;- prev
          </button>
          <span className="font-finger-paint text-sm text-[#8C8368]">
            page {page + 1} of {pages}
          </span>
          <button
            type="button"
            className={button}
            disabled={page >= pages - 1}
            onClick={() => setChosen(page + 1)}
          >
            next -&gt;
          </button>
        </nav>
      )}
    </>
  );
}
