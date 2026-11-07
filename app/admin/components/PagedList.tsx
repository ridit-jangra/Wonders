"use client";

import { Children, useState, type ReactNode } from "react";

export default function PagedList({
  children,
  perPage = 10,
  as: Tag = "ol",
  className,
}: {
  children: ReactNode;
  perPage?: number;
  as?: "ol" | "ul";
  className?: string;
}) {
  const items = Children.toArray(children);
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const [page, setPage] = useState(1);
  const current = Math.min(page, totalPages);
  const shown = items.slice((current - 1) * perPage, current * perPage);

  return (
    <>
      <Tag className={className}>{shown}</Tag>
      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between gap-4">
          <span className="hc-caption text-sm">
            Page {current} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="hc-btn hc-btn-outline hc-btn-sm"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-outline hc-btn-sm"
              disabled={current >= totalPages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
