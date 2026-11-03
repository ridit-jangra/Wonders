export const DEFAULT_GRANT_MAX_CENTS = 50000;

export interface GrantInput {
  amountCents: number;
  purpose: string;
  inviteMessage: string | null;
  keywordLock: string | null;
  oneTimeUse: boolean;
}

export function parseGrantInput(
  raw: {
    amount: string;
    purpose: string;
    message: string;
    keyword: string;
    oneTime: boolean;
  },
  maxCents: number,
): GrantInput | null {
  const amount = raw.amount.trim().replace(/^\$/, "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(amount)) return null;
  const amountCents = Math.round(parseFloat(amount) * 100);
  if (amountCents <= 0 || amountCents > maxCents) return null;

  const purpose = raw.purpose.trim();
  if (purpose.length === 0 || purpose.length > 200) return null;
  const message = raw.message.trim();
  if (message.length > 500) return null;
  const keyword = raw.keyword.trim();
  if (keyword.length > 100) return null;

  return {
    amountCents,
    purpose,
    inviteMessage: message || null,
    keywordLock: keyword || null,
    oneTimeUse: raw.oneTime,
  };
}

export function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}
