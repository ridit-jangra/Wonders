/* eslint-disable @next/next/no-img-element */

import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { getSessionProfile } from "@/lib/profiles";
import { canSeeAdminButton } from "@/lib/dashboard-access";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export async function Profile() {
  const session = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  const profile = await getSessionProfile(session);
  const showAdmin = await canSeeAdminButton(session.slackId);

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
      {showAdmin && (
        <a
          href="/admin"
          className="rounded-full bg-[#16213E]/80 px-3 py-1.5 font-finger-paint text-sm text-white shadow-md transition-all hover:zoom-110"
        >
          admin :D
        </a>
      )}
      <Link href="/dashboard/profile">
        <img
          className="size-12 rounded-full border-2 border-white object-cover shadow-md"
          src={profile?.slack_avatar_url ?? "/project-image-fallback.png"}
          alt={profile?.name ?? ""}
        />
      </Link>
    </div>
  );
}
