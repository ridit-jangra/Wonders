"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@hackclub/icons";
import { NAV, isNavActive } from "./nav";

export default function TopNav({
  counts,
  hrefs,
}: {
  counts: Record<string, number>;
  hrefs: string[];
}) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {NAV.filter((item) => hrefs.includes(item.href)).map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="hc-nav-link"
            data-active={active ? true : undefined}
          >
            <Icon glyph={item.glyph} size={20} aria-hidden />
            {item.label}
            {counts[item.href] > 0 && <span className="hc-nav-count">{counts[item.href]}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
