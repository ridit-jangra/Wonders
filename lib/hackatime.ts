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

export async function fetchHackatimeReport(slackId: string | null | undefined): Promise<HackatimeReport> {
  const empty: HackatimeReport = {
    ok: false,
    username: "",
    totalText: "",
    totalSeconds: 0,
    projects: [],
  };

  if (!slackId) {
    return empty;
  }

  try {
    const res = await fetch(
      `https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(slackId)}/stats?features=projects`,
      { signal: AbortSignal.timeout(10000), next: { revalidate: 300 } },
    );
    if (!res.ok) {
      return empty;
    }

    const json = (await res.json()) as {
      data?: {
        username?: string;
        human_readable_total?: string;
        total_seconds?: number;
        projects?: { name?: string; total_seconds?: number; text?: string; percent?: number }[];
      };
    };
    const data = json.data;
    if (!data) {
      return empty;
    }

    const projects: HackatimeProject[] = [];
    for (const project of data.projects ?? []) {
      if (!project.name) {
        continue;
      }
      projects.push({
        name: project.name,
        seconds: project.total_seconds ?? 0,
        text: project.text ?? "",
        percent: project.percent ?? 0,
      });
    }

    return {
      ok: true,
      username: data.username ?? "",
      totalText: data.human_readable_total ?? "",
      totalSeconds: data.total_seconds ?? 0,
      projects,
    };
  } catch {
    return empty;
  }
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
