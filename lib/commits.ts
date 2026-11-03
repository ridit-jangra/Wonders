import "server-only";

export interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface CommitResult {
  repo: string | null;
  commits: Commit[];
  total: number;
  firstDate: string | null;
  error: string | null;
}

export function parseGithubRepo(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "github.com") {
    return null;
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  const safe = /^[A-Za-z0-9._-]{1,100}$/;
  if (!safe.test(owner) || !safe.test(repo)) {
    return null;
  }

  return `${owner}/${repo}`;
}

export async function fetchCommits(githubUrl: string | null | undefined): Promise<CommitResult> {
  const repo = parseGithubRepo(githubUrl);
  if (!repo) {
    return { repo: null, commits: [], total: 0, firstDate: null, error: "No GitHub repo linked." };
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "wonders-admin",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const init = { headers, signal: AbortSignal.timeout(8000), next: { revalidate: 300 } } as const;
    const [res, countRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${repo}/commits?per_page=100`, init),
      fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, init).catch(() => null),
    ]);

    if (res.status === 404) {
      return { repo, commits: [], total: 0, firstDate: null, error: "Repo not found, or it's private." };
    }
    if (res.status === 403 || res.status === 429) {
      return { repo, commits: [], total: 0, firstDate: null, error: "GitHub rate limit hit. Set GITHUB_TOKEN to raise it." };
    }
    if (res.status === 409) {
      return { repo, commits: [], total: 0, firstDate: null, error: "The repo is empty." };
    }
    if (!res.ok) {
      return { repo, commits: [], total: 0, firstDate: null, error: `GitHub returned ${res.status}.` };
    }

    const data = (await res.json()) as {
      sha: string;
      html_url: string;
      commit: { message: string; author: { name: string; date: string } | null };
      author: { login: string } | null;
    }[];

    const commits: Commit[] = [];
    for (const item of data) {
      let author = "unknown";
      if (item.author?.login) {
        author = item.author.login;
      } else if (item.commit.author?.name) {
        author = item.commit.author.name;
      }

      commits.push({
        sha: item.sha,
        message: item.commit.message.split("\n")[0],
        author,
        date: item.commit.author?.date ?? "",
        url: item.html_url,
      });
    }

    let total = commits.length;
    let firstDate: string | null = commits.length > 0 ? commits[commits.length - 1].date : null;
    const lastPage = countRes?.ok
      ? Number(countRes.headers.get("link")?.match(/[?&]page=(\d+)>;\s*rel="last"/)?.[1])
      : NaN;
    if (Number.isFinite(lastPage) && lastPage > commits.length) {
      total = lastPage;
      try {
        const oldestRes = await fetch(
          `https://api.github.com/repos/${repo}/commits?per_page=1&page=${lastPage}`,
          init,
        );
        if (oldestRes.ok) {
          const oldest = (await oldestRes.json()) as { commit: { author: { date: string } | null } }[];
          firstDate = oldest[0]?.commit.author?.date ?? firstDate;
        }
      } catch {}
    }

    return { repo, commits, total, firstDate, error: null };
  } catch {
    return { repo, commits: [], total: 0, firstDate: null, error: "Couldn't reach GitHub." };
  }
}
