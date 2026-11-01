import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { Profile } from "@/app/dashboard/components/Profile";
import { canUseReferrals } from "@/lib/referrals";
import ExploreClient from "./_components/ExploreClient";

export default async function ExplorePage() {
  const session = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);

  const showRefers = session ? await canUseReferrals(session.slackId) : false;

  return (
    <>
      <ExploreClient loggedIn={Boolean(session)} showRefers={showRefers} />
      {session && <Profile />}
    </>
  );
}
