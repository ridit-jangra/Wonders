export function parseAllowedOrigins(raw: string | undefined, fallback: string[]) {
  const list = (raw ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return new Set(list.length > 0 ? list : fallback);
}

export function isMutatingMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export function isSameOriginRequest(
  request: { origin: string | null; secFetchSite: string | null },
  allowed: Set<string>,
) {
  const origin = request.origin?.replace(/\/+$/, "") ?? null;
  const site = request.secFetchSite;

  if (origin && !allowed.has(origin)) {
    return false;
  }
  if (site && site !== "same-origin") {
    return false;
  }
  if (!origin && site !== "same-origin") {
    return false;
  }
  return true;
}
