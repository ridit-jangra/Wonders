import type { GlyphName } from "@hackclub/icons";

export const NAV: { href: string; label: string; glyph: GlyphName; keywords: string }[] = [
  { href: "/admin", label: "Inbox", glyph: "dashboard-meter", keywords: "overview home dashboard" },
  { href: "/admin/review", label: "Review", glyph: "view", keywords: "queue first pass second pass" },
  { href: "/admin/fulfillment", label: "Fulfillment", glyph: "package", keywords: "rewards orders ship" },
  { href: "/admin/users", label: "Users", glyph: "people-3", keywords: "players people ban" },
  { href: "/admin/wonders", label: "Wonders", glyph: "rep", keywords: "projects all" },
  { href: "/admin/history", label: "History", glyph: "history", keywords: "activity status changes" },
  { href: "/admin/audit", label: "Audit", glyph: "private", keywords: "log security" },
  { href: "/admin/team", label: "Team", glyph: "people-2", keywords: "roles staff access" },
  { href: "/admin/settings", label: "Settings", glyph: "settings", keywords: "theme font accent" },
];
