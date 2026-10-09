import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import ExploreClient from "./_components/ExploreClient";

export default async function ExplorePage() {
  const session = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);

  return <ExploreClient loggedIn={Boolean(session)} />;
}
