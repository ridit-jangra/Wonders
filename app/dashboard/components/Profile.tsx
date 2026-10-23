/* eslint-disable @next/next/no-img-element */

import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { getSessionProfile } from "@/lib/profiles";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export async function Profile() {
  const session = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  const profile = await getSessionProfile(session);

  return (
    <Link href="/dashboard/profile" className="fixed top-4 right-4 z-50">
      <img
        className="size-12 rounded-full border-2 border-white object-cover shadow-md"
        src={profile?.slack_avatar_url ?? "/project-image-fallback.png"}
        alt={profile?.name ?? ""}
      />
    </Link>
  );
}
