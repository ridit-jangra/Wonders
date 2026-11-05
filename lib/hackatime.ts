import "server-only";

export interface HackatimeProject {
  name: string;
  seconds: number;
  text: string;
  percent: number;
}

export interface HackatimeReport {
  ok: boolean;
  username: string;
  totalText: string;
  totalSeconds: number;
  projects: HackatimeProject[];
}

export const HACKATIME_SITE = "https://hackatime.hackclub.com";
export const HACKATIME_AUTHORIZE_URL = `${HACKATIME_SITE}/oauth/authorize`;
export const HACKATIME_TOKEN_URL = `${HACKATIME_SITE}/oauth/token`;
export const HACKATIME_SCOPE = "profile read";
export const HACKATIME_STATE_COOKIE = "wonders_hackatime_state";

export async function fetchHackatimeSlackId(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${HACKATIME_SITE}/api/v1/authenticated/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return null;
    }
    type Ids = { slack_id?: unknown; slack_uid?: unknown };
    const body = (await res.json()) as (Ids & { user?: Ids; data?: Ids }) | null;
    const raw =
      body?.slack_id ??
      body?.slack_uid ??
      body?.user?.slack_id ??
      body?.user?.slack_uid ??
      body?.data?.slack_id ??
      body?.data?.slack_uid;
    return typeof raw === "string" && /^[A-Z0-9]{6,20}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function fetchHackatimeProjects(
  token: string,
): Promise<{ name: string; seconds: number }[] | null> {
  try {
    const res = await fetch(`${HACKATIME_SITE}/api/v1/authenticated/projects`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as { projects?: unknown[]; data?: { projects?: unknown[] } };
    return (body.projects ?? body.data?.projects ?? [])
      .map((p) => {
        const o = p as { name?: unknown; total_seconds?: unknown; seconds?: unknown };
        return { name: String(o.name ?? ""), seconds: Number(o.total_seconds ?? o.seconds ?? 0) || 0 };
      })
      .filter((p) => p.name.length > 0);
  } catch {
    return null;
  }
}

export interface HackatimeAirtableInfo {
  userId: string;
  ranges: string;
}

function formatRangeDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

export async function fetchHackatimeAirtableInfo(
  slackId: string | null | undefined,
  linkedProjects: string[],
): Promise<HackatimeAirtableInfo> {
  const empty: HackatimeAirtableInfo = { userId: "", ranges: "" };
  if (!slackId) return empty;
  const id = encodeURIComponent(slackId);

  let userId = "";
  try {
    const res = await fetch(`${HACKATIME_SITE}/api/v1/users/${id}/stats?features=projects`, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json()) as { data?: { user_id?: unknown } };
      if (body.data?.user_id != null) userId = String(body.data.user_id);
    }
  } catch {}

  const parts = await Promise.all(
    linkedProjects.map(async (name) => {
      try {
        const res = await fetch(
          `${HACKATIME_SITE}/api/v1/users/${id}/heartbeats/spans?filter_by_project=${encodeURIComponent(name)}`,
          { signal: AbortSignal.timeout(8000), cache: "no-store" },
        );
        if (!res.ok) return null;
        const body = (await res.json()) as { spans?: { start_time?: unknown; end_time?: unknown }[] };
        let first = Infinity;
        let last = 0;
        for (const span of body.spans ?? []) {
          first = Math.min(first, Number(span.start_time) || Infinity);
          last = Math.max(last, Number(span.end_time) || 0);
        }
        if (!Number.isFinite(first) || last <= 0) return null;
        return `${name} ${formatRangeDate(first)}-${formatRangeDate(last)}`;
      } catch {
        return null;
      }
    }),
  );

  return { userId, ranges: parts.filter((part): part is string => part !== null).join(", ") };
}
