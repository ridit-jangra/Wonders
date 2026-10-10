import "server-only";
import { after } from "next/server";
import { sendDirectMessage } from "@/lib/slack";

const DASHBOARD_URL = "https://wonders.ridit.space/dashboard";

export type WonderEvent =
  | "in_review"
  | "first_pass_approved"
  | "second_pass_approved"
  | "changes_requested"
  | "fulfillment_started"
  | "reward_ordered"
  | "reward_sent"
  | "fulfilled";

function escapeSlack(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function quote(text: string) {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function messageFor(event: WonderEvent, title: string, note: string) {
  if (event === "in_review") {
    return `hey hey! :pixo-wave: your wonder *${title}* is in review now :3\na reviewer will take a look soon. you can't edit it while it's being reviewed, but i'll DM you the moment something changes!`;
  }
  if (event === "first_pass_approved") {
    return `*${title}* just passed the first round of review :mwah-france:\none more pass to go and then it's out in the world :3`;
  }
  if (event === "second_pass_approved") {
    return `*${title}* passed its final review!! :mwah-france:\nit's live on Explore now for everyone to see :D and a little surprise is on its way to you soon... :eyes_shaking:`;
  }
  if (event === "changes_requested") {
    return `your wonder *${title}* needs a little fix before it can go through :c\nhere's what the reviewer said:\n${quote(note)}\nfix it up on your dashboard and ship it again whenever you're ready, you got this :3`;
  }
  if (event === "fulfillment_started") {
    return `your surprise for *${title}* is being put together :roo-gift:\nno peeking! i'll let you know when it's on the move :3`;
  }
  if (event === "reward_ordered") {
    return `your surprise for *${title}* has been ordered :package:\nit's officially happening :D`;
  }
  if (event === "reward_sent") {
    return `your surprise for *${title}* is on its way to you :truck:\nkeep an eye on your mailbox :eyes_shaking:`;
  }
  return `your surprise for *${title}* has arrived!! :tw_tada:\nthank you for making something wonderful :3 can't wait to see what you build next`;
}

export function notifyPlayer(
  slackUserId: string | null | undefined,
  event: WonderEvent,
  wonder: { title: string; note?: string | null },
) {
  if (!slackUserId || !process.env.SLACK_BOT_TOKEN) {
    return;
  }

  after(async () => {
    try {
      const text = messageFor(event, escapeSlack(wonder.title), escapeSlack(wonder.note ?? ""));
      await sendDirectMessage(slackUserId, `${text}\n\n<${DASHBOARD_URL}|open your dashboard>`);
    } catch (err) {
      console.error("Failed to DM player:", err);
    }
  });
}
