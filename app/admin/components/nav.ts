import type { GlyphName } from "@hackclub/icons";

export const NAV: { href: string; label: string; glyph: GlyphName }[] = [
  { href: "/admin", label: "Overview", glyph: "dashboard-meter" },
  { href: "/admin/review", label: "Review", glyph: "view" },
  { href: "/admin/fulfillment", label: "Fulfillment", glyph: "package" },
  { href: "/admin/users", label: "Users", glyph: "people-3" },
  { href: "/admin/wonders", label: "Wonders", glyph: "rep" },
  { href: "/admin/history", label: "History", glyph: "history" },
];

export function isNavActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(href + "/");
}
