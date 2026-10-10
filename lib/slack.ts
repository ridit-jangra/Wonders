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

export async function fetchSlackProfile(
  slackUserId: string,
): Promise<{ displayName: string | null; avatarUrl: string | null }> {
  const empty = { displayName: null, avatarUrl: null };
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !slackUserId) return empty;

  try {
    const res = await fetch(
      `${SLACK_API_BASE}/users.info?user=${encodeURIComponent(slackUserId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      user?: {
        name?: string;
        profile?: { display_name?: string; image_512?: string; image_192?: string };
      };
    };
    if (!data.ok) {
      console.error("Slack users.info failed:", data.error);
      return empty;
    }
    return {
      displayName: data.user?.profile?.display_name || data.user?.name || null,
      avatarUrl: data.user?.profile?.image_512 || data.user?.profile?.image_192 || null,
    };
  } catch (err) {
    console.error("Slack users.info failed:", err);
    return empty;
  }
}

export async function sendDirectMessage(slackUserId: string, text: string): Promise<void> {
  const res = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getBotToken()}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: slackUserId,
      text,
      unfurl_links: false,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error("Slack DM failed:", data.error);
  }
}
