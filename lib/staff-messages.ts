export interface StaleWonder {
  id: number;
  title: string;
  status: "in_review" | "second_pass";
  waitingHours: number;
}

export interface WeeklyDigest {
  firstPass: number;
  secondPass: number;
  onHold: number;
  oldestHours: number | null;
  oldestTitle: string | null;
  submitted: number;
  passedFirst: number;
  approved: number;
  sentBack: number;
  fulfilled: number;
  awaitingFulfillment: number;
  inFulfillment: number;
}

export function formatWait(hours: number): string {
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function mention(slackId: string): string {
  return `<@${slackId}>`;
}

export function formatStaleMessage(
  items: StaleWonder[],
  baseUrl: string,
  pings: string[],
): string {
  const lines = items.map((item) => {
    const pass = item.status === "second_pass" ? "second pass" : "first pass";
    return `• <${baseUrl}/admin/review/${item.id}|${item.title}> (${pass}), waiting ${formatWait(item.waitingHours)}`;
  });
  const noun = items.length === 1 ? "wonder has" : "wonders have";
  return `${pings.map(mention).join(" ")} ${items.length} ${noun} been sitting in the review queue for a while:\n${lines.join("\n")}`;
}

export function formatDigest(digest: WeeklyDigest, baseUrl: string, pings: string[]): string {
  const oldest =
    digest.oldestHours !== null
      ? `oldest has waited ${formatWait(digest.oldestHours)}${digest.oldestTitle ? ` (${digest.oldestTitle})` : ""}`
      : "nothing is waiting";
  return [
    `${pings.map(mention).join(" ")} weekly wonders summary :3`,
    "",
    `*Queue right now:* ${digest.firstPass} in first pass, ${digest.secondPass} in second pass, ${digest.onHold} on hold. ${oldest}. <${baseUrl}/admin/review|open the queue>`,
    `*Last 7 days:* ${digest.submitted} submitted, ${digest.passedFirst} passed first pass, ${digest.approved} approved and shipped, ${digest.sentBack} sent back, ${digest.fulfilled} fulfilled.`,
    `*Fulfillment:* ${digest.awaitingFulfillment} waiting to start, ${digest.inFulfillment} in progress. <${baseUrl}/admin/fulfillment|open fulfillment>`,
  ].join("\n");
}
