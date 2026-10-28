import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const REAUTH_TTL_MS = 10 * 60 * 1000;

function key(secret: string) {
  return createHash("sha256").update(secret).update("wonders:admin-reauth:v1").digest();
}

function sign(secret: string, payload: string) {
  return createHmac("sha256", key(secret)).update(payload).digest("base64url");
}

export function createReauthValue(secret: string, slackId: string, now = Date.now()) {
  const expiresAt = now + REAUTH_TTL_MS;
  const payload = `${slackId}.${expiresAt}`;
  return { value: `${payload}.${sign(secret, payload)}`, expiresAt };
}

export function verifyReauthValue(
  secret: string,
  raw: string | undefined | null,
  expectedSlackId: string,
  now = Date.now(),
) {
  if (!raw) {
    return false;
  }
  const parts = raw.split(".");
  if (parts.length !== 3) {
    return false;
  }
  const [slackId, expiresRaw, signature] = parts;
  const expiresAt = Number(expiresRaw);
  if (!slackId || slackId !== expectedSlackId || !Number.isFinite(expiresAt)) {
    return false;
  }
  if (expiresAt <= now) {
    return false;
  }
  const expected = Buffer.from(sign(secret, `${slackId}.${expiresRaw}`));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
