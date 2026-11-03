import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { Profile } from "@/app/dashboard/components/Profile";
import { canUseReferrals } from "@/lib/referrals";
import { canSeeAdminButton } from "@/lib/dashboard-access";
import { getAdminSession } from "@/lib/admin";
import { canManagePlayers } from "@/lib/security/roles";
import ExploreClient from "./_components/ExploreClient";

export default async function ExplorePage() {
  const session = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);

  const showRefers = session ? await canUseReferrals(session.slackId) : false;
  const showAdmin = session ? await canSeeAdminButton(session.slackId) : false;
  const adminSession = await getAdminSession();
  const isAdmin = Boolean(adminSession && canManagePlayers(adminSession));

  return (
    <>
      <ExploreClient loggedIn={Boolean(session)} showRefers={showRefers} showAdmin={showAdmin} isAdmin={isAdmin} />
      {session && <Profile />}
    </>
  );
}
