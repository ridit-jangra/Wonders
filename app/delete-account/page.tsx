/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import { getSessionProfile } from "@/lib/profiles";
import { writeAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { postChannelMessage } from "@/lib/slack";
import { YSWS } from "@/lib/ysws-config";
import SubmitButton from "@/app/dashboard/components/SubmitButton";
import BackButton from "@/app/dashboard/components/BackButton";

export const metadata: Metadata = {
  title: "Delete my account",
  robots: { index: false, follow: false },
};

export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;
  const session = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  const profile = await getSessionProfile(session);
  if (!profile) redirect("/onboarding");

  async function requestDeletion(formData: FormData) {
    "use server";
    const current = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
    if (!current) redirect("/login");
    const owner = await getSessionProfile(current);
    if (!owner) redirect("/onboarding");

    if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== "delete my account") {
      redirect("/delete-account?error=confirm");
    }
    if (!(await checkRateLimit("delete-request", current.slackId, 3, 3600)).allowed) {
      redirect("/delete-account?error=slow");
    }

    const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);
    await writeAudit({
      actor: current.slackId,
      action: "account.delete_request",
      target: owner.id,
      detail: { reason },
      sensitive: true,
    });
    await postChannelMessage(
      YSWS.slack.staffChannelId,
      `${YSWS.slack.staleQueuePing.map((id) => `<@${id}>`).join(" ")} <@${current.slackId}> asked to delete their Wonders account.${reason ? `\n> ${reason.replace(/\n/g, "\n> ")}` : ""}`,
    );
    redirect("/delete-account?sent=1");
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center px-6 py-16">
      <img className="fixed inset-0 -z-10 h-full w-full object-cover" src="/bg-effect-4.png" alt="" />
      <div className="flex w-full max-w-xl flex-col gap-4">
        <BackButton href="/dashboard/profile" />
        <h1 className="font-finger-paint text-3xl text-[#5C4A2E]">delete my account</h1>

        {sent ? (
          <p className="rounded-md bg-[#E7E2C9] p-4 font-finger-paint text-[#5C4A2E]">
            got it :3 the team will delete your account and everything on it, and let you know on Slack when it&apos;s
            done.
          </p>
        ) : (
          <form action={requestDeletion} className="flex flex-col gap-4 rounded-md bg-[#E7E2C9] p-4 font-finger-paint text-[#5C4A2E]">
            <p>
              this asks the team to delete your account ({profile.slack_display_name || profile.name}) along with your
              wonders, journal entries, team memberships, referrals and saved details.
            </p>
            <p className="text-sm text-[#7A6B4A]">
              it can&apos;t be undone. a wonder that is already in review or in the middle of getting its surprise may
              take a bit longer, and anything already sent to the Hack Club YSWS database has to be removed by Hack Club
              itself.
            </p>
            <label className="flex flex-col gap-1 text-sm">
              anything you want us to know? (optional)
              <textarea
                name="reason"
                rows={3}
                maxLength={1000}
                className="w-full resize-none border border-[#8C8368]/30 bg-[#F0EBD1] px-4 py-3 text-base text-[#5C4A2E] focus:border-[#8C8368] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              type <b>delete my account</b> to confirm
              <input
                name="confirm"
                required
                autoComplete="off"
                className="w-full border border-[#8C8368]/30 bg-[#F0EBD1] px-4 py-2 text-base text-[#5C4A2E] focus:border-[#8C8368] focus:outline-none"
              />
            </label>
            {error === "confirm" && <p className="text-sm text-[#a33]">that didn&apos;t match, try again</p>}
            {error === "slow" && <p className="text-sm text-[#a33]">too many requests, try again in a bit</p>}
            <div className="flex sm:justify-end">
              <SubmitButton
                pendingLabel="sending... :3"
                className="w-full rounded-md bg-[#F2B3AD] px-4 py-2 text-lg text-black/50 hover:zoom-110 transition-all sm:w-56"
              >
                Request deletion
              </SubmitButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
