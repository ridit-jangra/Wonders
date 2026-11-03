/* eslint-disable @next/next/no-img-element */
import { notFound, redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { getSessionProfile } from "@/lib/profiles";
import {
  canUseReferrals,
  getReferralStats,
  getReferredBy,
  refreshPendingVerifications,
  REFERRALS_FOR_PIN,
} from "@/lib/referrals";
import Sidebar from "@/app/dashboard/components/Sidebar";
import { canSeeAdminButton } from "@/lib/dashboard-access";
import { Profile } from "@/app/dashboard/components/Profile";
import LocalTime from "@/app/dashboard/components/LocalTime";
import CopyLink from "./CopyLink";
import PinHero from "./PinHero";
import Panel from "./Panel";
import TopBlur from "@/app/dashboard/components/TopBlur";

export const metadata = { title: "Refers - Wonders" };

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (process.env.NODE_ENV === "production" || !host) return "https://wonders.hackclub.com";
  return `http://${host}`;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-md bg-[#E7E2C9] px-4 py-4">
      <span className="font-poppins text-4xl font-semibold text-[#5C4A2E]">{value}</span>
      <span className="font-finger-paint text-sm text-[#5C4A2E]/70">{label}</span>
    </div>
  );
}

export default async function RefersPage() {
  const session = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  const profile = await getSessionProfile(session);
  if (!profile?.interest) redirect("/onboarding");
  if (!(await canUseReferrals(profile.slack_id))) notFound();

  await refreshPendingVerifications(profile.id);
  const [stats, referredBy, origin] = await Promise.all([
    getReferralStats(profile.id),
    getReferredBy(profile.id),
    siteOrigin(),
  ]);
  const link = `${origin}/r/${stats.slug}`;
  const progress = Math.min(stats.qualified, REFERRALS_FOR_PIN);
  const left = Math.max(0, REFERRALS_FOR_PIN - stats.qualified);

  return (
    <div className="relative flex min-h-screen">
      <img className="fixed inset-0 -z-10 h-full w-full object-cover" src="/bg-effect-4.png" alt="" />
      <div className="pointer-events-none fixed top-0 right-[2%] bottom-0 left-0 -z-10 hidden md:left-[calc(100vh*554/1080-10vh)] md:block">
        <img src="/new-or-edit-projects-template.png" alt="" className="h-full w-full object-fill" />
      </div>
      <TopBlur />
      <Sidebar showRefers showAdmin={await canSeeAdminButton(profile.slack_id)} />
      <Profile />
      <main className="relative min-w-0 flex-1 bg-[#F0EBD1] px-6 pb-10 pt-24 sm:px-10 md:bg-transparent md:py-16 md:pl-4 md:pr-14 lg:py-24">
        <div className="flex flex-col gap-6 md:max-w-[90%]">
          <h1 className="font-finger-paint text-3xl text-[#5C4A2E] sm:text-4xl lg:text-5xl">Refers</h1>

          {referredBy && (
            <div className="bg-[#BFD8A8]/90 p-5 md:p-7">
              <p className="font-finger-paint text-xl text-[#2f4a24]">
                {referredBy.name} invited you!{" "}
                {referredBy.sticker_sent_at
                  ? "your stickers are on their way :D"
                  : "we're sending you a pack of stickers :3"}
              </p>
            </div>
          )}

          <PinHero progress={progress} left={left} pinSent={Boolean(stats.pinSentAt)} />

          <Panel>
            <h2 className="mb-3 font-finger-paint text-2xl text-[#5C4A2E]">your link</h2>
            <CopyLink url={link} />
            <p className="mt-3 font-finger-paint text-sm text-[#5C4A2E]/70">
              when someone opens it and signs up for the first time, it counts. people who already have an account
              can&apos;t be referred.
            </p>
          </Panel>

          <Panel>
            <h2 className="mb-4 font-finger-paint text-2xl text-[#5C4A2E]">how it works</h2>
            <ol className="grid gap-3 md:grid-cols-3">
              {([
                ["1", "share your link", "send it anywhere: slack, discord, your group chat."],
                ["2", "they sign up", "a brand new player logs in, gets their ID verified by Hack Club and finishes onboarding."],
                ["3", "everyone gets stuff", <>they get stickers, you get a pin after <span className="font-poppins">{REFERRALS_FOR_PIN}</span> friends.</>],
              ] as [string, string, React.ReactNode][]).map(([n, title, text]) => (
                <li key={n} className="rounded-md bg-[#E7E2C9] p-4">
                  <span className="font-finger-paint text-3xl text-[#c9a227]">{n}</span>
                  <p className="font-finger-paint text-lg text-[#5C4A2E]">{title}</p>
                  <p className="font-finger-paint text-sm text-[#5C4A2E]/70">{text}</p>
                </li>
              ))}
            </ol>
          </Panel>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Stat value={stats.clicks} label="link clicks" />
            <Stat value={stats.visitors} label="unique visitors" />
            <Stat value={stats.referred.length} label="signed up" />
            <Stat value={stats.qualified} label="counted" />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Panel>
              <h2 className="mb-3 font-finger-paint text-2xl text-[#5C4A2E]">who joined</h2>
              {stats.referred.length === 0 ? (
                <p className="rounded-md bg-[#E7E2C9] px-4 py-3 font-finger-paint text-base text-[#5C4A2E]/70">nobody yet. send your link!</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {stats.referred.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 rounded-md bg-[#E7E2C9] p-3">
                      {r.avatar ? (
                        <img src={r.avatar} alt="" className="h-10 w-10 rounded-full" />
                      ) : (
                        <span className="h-10 w-10 rounded-full bg-[#8C8368]/30" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-finger-paint text-base text-[#5C4A2E]">{r.name}</p>
                        <p className="font-finger-paint text-xs text-[#5C4A2E]/60">
                          <LocalTime iso={r.joinedAt} />
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 font-finger-paint text-xs ${
                          r.counted ? "bg-[#86c77a] text-[#17301a]" : "bg-[#8C8368]/25 text-[#5C4A2E]"
                        }`}
                      >
                        {r.counted ? "counted" : r.verified ? "setting up" : "needs ID check"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel>
              <h2 className="mb-3 font-finger-paint text-2xl text-[#5C4A2E]">recent clicks</h2>
              {stats.recentClicks.length === 0 ? (
                <p className="rounded-md bg-[#E7E2C9] px-4 py-3 font-finger-paint text-base text-[#5C4A2E]/70">no clicks yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {stats.recentClicks.map((at, i) => (
                    <li
                      key={`${at}-${i}`}
                      className="flex items-center justify-between rounded-md bg-[#E7E2C9] px-4 py-3 font-finger-paint text-sm text-[#5C4A2E]"
                    >
                      <span>someone opened your link</span>
                      <span className="text-[#5C4A2E]/60">
                        <LocalTime iso={at} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 font-finger-paint text-xs text-[#5C4A2E]/60">
                clicks are anonymous. you see names once someone signs up.
              </p>
            </Panel>
          </div>
        </div>
      </main>
    </div>
  );
}
