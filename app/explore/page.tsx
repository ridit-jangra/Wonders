import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { Profile } from "@/app/dashboard/components/Profile";
import { canUseReferrals } from "@/lib/referrals";
import { getAdminSession } from "@/lib/admin";
import { canManagePlayers } from "@/lib/security/roles";
import { canCreateWonders } from "@/lib/creation";
import ExploreClient from "./_components/ExploreClient";

export const metadata: Metadata = {
  title: "Explore wonders",
  description:
    "Browse the projects people are making for Wonders, the Hack Club YSWS. Hardware and software, big and small, from teens around the world.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "Explore wonders · Wonders",
    description: "Browse the projects people are making for Wonders, the Hack Club YSWS.",
    url: "/explore",
  },
};

export default async function ExplorePage() {
  const session = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);

  const showRefers = session ? await canUseReferrals(session.slackId) : false;
  const adminSession = await getAdminSession();
  const isAdmin = Boolean(adminSession && canManagePlayers(adminSession));

  return (
    <>
      <ExploreClient loggedIn={Boolean(session)} showRefers={showRefers} isAdmin={isAdmin} canCreate={await canCreateWonders()} />
      {session && <Profile />}
    </>
  );
}
