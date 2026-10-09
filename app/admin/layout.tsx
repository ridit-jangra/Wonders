/* eslint-disable @next/next/no-img-element */
import "./admin.css";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { countProjectsByStatus } from "@/lib/projects";
import TopNav from "./components/TopNav";
import { Button, ButtonLink, Mono } from "./components/ui";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const byStatus = await countProjectsByStatus();

  const navCounts: Record<string, number> = {
    "/admin/review": byStatus.in_review + byStatus.second_pass,
    "/admin/fulfillment": byStatus.shipped + byStatus.fulfillment_started,
  };

  let displayName = "Admin";
  if (admin.name) {
    displayName = admin.name.split(" ")[0];
  } else if (admin.email) {
    displayName = admin.email.split("@")[0];
  }

  return (
    <div className="admin-shell">
      <header className="hc-topbar sticky top-0 z-10">
        <div className="hc-topbar-inner mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-6">
          <Link href="/admin" className="flex shrink-0 items-center gap-2">
            <img
              src="/favicon.png"
              alt="Wonders"
              width={28}
              height={28}
            />
            <span className="hc-heading">Wonders</span>
          </Link>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <TopNav counts={navCounts} />
          </div>
          <div className="hidden shrink-0 items-center gap-3 lg:flex">
            <span className="text-sm">
              <span className="font-bold">{displayName}</span>{" "}
              <span className="hc-muted">
                (<Mono>{admin.slackId}</Mono>)
              </span>
            </span>
            <ButtonLink href="/dashboard" variant="cream" size="sm">
              Back to app
            </ButtonLink>
            <form action="/api/admin-auth/logout" method="post">
              <Button type="submit" variant="ghost" size="sm" icon="door-leave">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="hc-main mx-auto max-w-[1440px] px-6 py-8">{children}</main>
    </div>
  );
}
