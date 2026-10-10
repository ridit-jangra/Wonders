import "server-only";

export interface YswsEntry {
  id: string;
  ysws: string;
  approved_at: number | null;
  code_url: string | null;
  demo_url: string | null;
  description: string | null;
  github_username: string | null;
  hours: number | null;
}

export interface YswsMatch {
  entry: YswsEntry;
  name: string;
  repoMatches: boolean;
  demoMatches: boolean;
}

const CACHE_MS = 5 * 60 * 1000;

let cachedEntries: YswsEntry[] | null = null;
let cachedAt = 0;
let pendingFetch: Promise<YswsEntry[] | null> | null = null;

async function loadEntries(): Promise<YswsEntry[] | null> {
  if (cachedEntries && Date.now() - cachedAt < CACHE_MS) {
    return cachedEntries;
  }

  if (pendingFetch) {
    return pendingFetch;
  }

  pendingFetch = (async () => {
    try {
      const res = await fetch("https://ships.hackclub.com/api/v1/ysws_entries", {
        signal: AbortSignal.timeout(30000),
        cache: "no-store",
      });
      if (!res.ok) {
        return cachedEntries;
      }
      const data = (await res.json()) as YswsEntry[];
      cachedEntries = data;
      cachedAt = Date.now();
      return data;
    } catch {
      return cachedEntries;
    } finally {
      pendingFetch = null;
    }
  })();

  return pendingFetch;
}

function normalizeUrl(url: string | null | undefined): string {
  if (!url) {
    return "";
  }
  let value = url.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/^www\./, "");
  value = value.replace(/\.git$/, "");
  value = value.replace(/\/+$/, "");
  return value;
}

function projectName(entry: YswsEntry): string {
  const code = (entry.code_url ?? "").trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const fromCode = code.split("/").pop() ?? "";
  if (fromCode) {
    return fromCode;
  }
  const demo = (entry.demo_url ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return demo || "Untitled";
}

export async function findOtherYswsEntries(project: {
  githubUrl: string | null;
  demoUrl: string | null;
}): Promise<{ ok: boolean; matches: YswsMatch[] }> {
  const entries = await loadEntries();
  if (!entries) {
    return { ok: false, matches: [] };
  }

  const repo = normalizeUrl(project.githubUrl);
  const demo = normalizeUrl(project.demoUrl);

  const matches: YswsMatch[] = [];
  for (const entry of entries) {
    const repoMatches = repo !== "" && normalizeUrl(entry.code_url) === repo;
    const demoMatches = demo !== "" && normalizeUrl(entry.demo_url) === demo;
    if (repoMatches || demoMatches) {
      matches.push({ entry, name: projectName(entry), repoMatches, demoMatches });
    }
  }

  matches.sort((a, b) => (b.entry.approved_at ?? 0) - (a.entry.approved_at ?? 0));
  return { ok: true, matches };
}
