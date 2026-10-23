/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import {
  getProfileAddress,
  getSessionProfile,
  revokeSessions,
} from "@/lib/profiles";
import SubmitButton from "../components/SubmitButton";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex w-full flex-col gap-3 md:max-w-[90%]">
      <h2 className="font-finger-paint text-2xl text-[#5C4A2E]">{title}</h2>
      <div className="border border-[#8C8368]/30 bg-[#E7E2C9] px-4 py-4 md:border-0">
        {children}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <p className="font-finger-paint text-sm text-[#5C4A2E]/70">{label}</p>
      <div className="font-finger-paint text-base break-words text-[#5C4A2E]">
        {children}
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  const session = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  const profile = await getSessionProfile(session);
  if (!profile) redirect("/onboarding");

  const address = await getProfileAddress(profile.id);
  const userAgent = (await headers()).get("user-agent") ?? "unknown device";
  const hackatimeConnected = Boolean(profile.hackatime_connected_at);

  async function logoutEverywhereAction() {
    "use server";

    const current = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
    if (!current) redirect("/login");
    const currentProfile = await getSessionProfile(current);
    if (!currentProfile) redirect("/onboarding");

    await revokeSessions(currentProfile.id);
    redirect("/api/hc-auth/logout");
  }

  return (
    <div className="relative flex min-h-screen flex-col gap-6 bg-[#F0EBD1] px-6 pt-24 pb-10 sm:px-10 md:bg-transparent md:pr-14 md:pl-4 md:py-16 lg:py-28">
      <div className="pointer-events-none fixed top-0 right-[2%] bottom-0 left-0 -z-10 hidden md:block md:left-[calc(100vh*554/1080-10vh)]">
        <img
          src="/new-or-edit-projects-template.png"
          alt=""
          className="h-full w-full object-fill"
        />
      </div>
      <h1 className="font-finger-paint text-3xl text-[#5C4A2E] sm:text-4xl lg:text-5xl">
        Your account :3
      </h1>

      <Section title="Profile :)">
        <div className="flex flex-col-reverse gap-6 sm:flex-row sm:justify-between">
          <div className="flex flex-col gap-4">
            <Field label="name">{profile.name}</Field>
            <Field label="email">{profile.email}</Field>
            <Field label="slack">{profile.slack_id}</Field>
            <Field label="hackatime">
              {hackatimeConnected ? "connected :D" : "not connected :("}{" "}
              <a
                href="/api/hackatime/connect"
                className="underline decoration-[#5C4A2E]/40 underline-offset-4 hover:decoration-[#5C4A2E]"
              >
                {hackatimeConnected ? "relink" : "connect"}
              </a>
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-finger-paint text-sm text-[#5C4A2E]/70">
              profile picture
            </p>
            <img
              src={profile.slack_avatar_url ?? "/project-image-fallback.png"}
              alt={profile.name}
              className="size-36 rounded-full object-cover"
            />
            <p className="max-w-36 font-finger-paint text-xs text-[#5C4A2E]/70">
              synced from slack
            </p>
          </div>
        </div>
      </Section>

      <Section title="Shipping :D">
        {address ? (
          <div className="font-finger-paint text-base text-[#5C4A2E]">
            <p>{profile.name}</p>
            <p>{address.line1}</p>
            {address.line2 && <p>{address.line2}</p>}
            <p>
              {address.city}, {address.state} {address.postal}
            </p>
            <p>{address.country}</p>
          </div>
        ) : (
          <p className="font-finger-paint text-base text-[#5C4A2E]/70">
            no address on file yet :c
          </p>
        )}
        <p className="mt-3 font-finger-paint text-sm text-[#5C4A2E]/70">
          wrong or out of date?{" "}
          <a
            href="https://auth.hackclub.com"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            edit it at Hack Club
          </a>
          , then log in again to refresh it
        </p>
      </Section>

      <Section title="Sessions :3">
        <Field label="this device">
          <span className="text-sm">{userAgent}</span>
        </Field>
        <form action={logoutEverywhereAction} className="mt-4 flex sm:justify-end">
          <SubmitButton
            pendingLabel="logging you out... :3"
            className="w-full rounded-md bg-[#F2B3AD] px-4 py-2 font-finger-paint text-lg text-black/40 hover:zoom-110 transition-all sm:w-64"
          >
            Log out everywhere :(
          </SubmitButton>
        </form>
      </Section>
    </div>
  );
}
