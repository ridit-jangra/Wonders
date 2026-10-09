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
