import "server-only";

const SLACK_API_BASE = "https://slack.com/api";

function getBotToken() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN env var is not set");
  return token;
}

function getChannelId() {
  const channelId = process.env.SLACK_CHANNEL_ID;
  if (!channelId) throw new Error("SLACK_CHANNEL_ID env var is not set");
  return channelId;
}

export async function inviteToChannel(slackUserId: string): Promise<void> {
  const res = await fetch(`${SLACK_API_BASE}/conversations.invite`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getBotToken()}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: getChannelId(),
      users: slackUserId,
    }),
  });

  const data = await res.json();
  if (!data.ok && data.error !== "already_in_channel") {
    console.error("Slack invite failed:", data.error);
  }
}
