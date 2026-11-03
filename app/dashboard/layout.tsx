/* eslint-disable @next/next/no-img-element */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { getSessionProfile } from "@/lib/profiles";
import { isStaffSlackId } from "@/lib/admin";
import UnderConstruction from "@/app/components/UnderConstruction";
import Sidebar from "./components/Sidebar";
import TopBlur from "./components/TopBlur";
import { Profile } from "./components/Profile";

export default async function DashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    redirect("/login");
  }

  const profile = await getSessionProfile(session);
  if (!profile?.interest) {
    redirect("/onboarding");
  }

  if (!(await isStaffSlackId(profile.slack_id))) {
    return <UnderConstruction />;
  }

  return (
    <div className="relative flex min-h-screen">
      <img
        className="fixed inset-0 -z-10 h-full w-full object-cover"
        src={"/bg-effect-4.png"}
        alt=""
      />
      <TopBlur />
      <Sidebar showRefers />
      <main className="relative min-w-0 flex-1">{children}</main>
      <Profile />
    </div>
  );
}
