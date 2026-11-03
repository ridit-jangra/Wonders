import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const MAX_COLLABORATORS = 5;

export function generateInviteCode(): string {
  let raw = "";
  for (let i = 0; i < 8; i++) {
    raw += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function normalizeInviteCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 8) return null;
  for (const char of raw) {
    if (!ALPHABET.includes(char)) return null;
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}
