const IP_SHAPE = /^[0-9a-fA-F:.]{2,64}$/;

export function clientIp(
  headers: { get(name: string): string | null },
  trustedHops = 1,
): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      const candidate = parts[Math.max(0, parts.length - Math.max(1, trustedHops))];
      if (IP_SHAPE.test(candidate)) {
        return candidate;
      }
    }
  }

  const real = headers.get("x-real-ip")?.trim();
  if (real && IP_SHAPE.test(real)) {
    return real;
  }
  return "unknown";
}
