import { fetchCommits } from "@/lib/commits";
import { fetchHackatimeReport } from "@/lib/hackatime";
import { findOtherYswsEntries } from "@/lib/ysws";
import { SECOND_PASS_CHECKS, type ProjectReview } from "@/lib/reviews";
import { Badge, EmptyState, Mono, Muted, Table, TextLink } from "../../components/ui";

function formatDate(value: string | number) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PanelLoading({ label }: { label: string }) {
  return <p className="hc-caption p-6 text-sm">Loading {label}…</p>;
}

export async function CommitsPanel({ githubUrl }: { githubUrl: string | null }) {
  const result = await fetchCommits(githubUrl);

  if (result.error) {
    return <EmptyState title="No commits" icon="github">{result.error}</EmptyState>;
  }

  if (result.commits.length === 0) {
    return <EmptyState title="No commits" icon="github">This repo has no commits yet.</EmptyState>;
  }

  const newest = result.commits[0];
  const oldest = result.commits[result.commits.length - 1];

  return (
    <div>
      <p className="hc-caption border-b border-[var(--border)] px-4 py-3 text-sm">
        <Mono>{result.repo}</Mono> · {result.commits.length}
        {result.commits.length === 100 ? "+" : ""} commits · {formatDate(oldest.date)} → {formatDate(newest.date)}
      </p>
      <Table headers={["When", "Commit", "Message", "Author"]}>
        {result.commits.map((commit) => (
          <tr key={commit.sha}>
            <td className="whitespace-nowrap">
              <Muted>
                <Mono>{formatDateTime(commit.date)}</Mono>
              </Muted>
            </td>
            <td>
              <TextLink href={commit.url} external>
                <Mono>{commit.sha.slice(0, 7)}</Mono>
              </TextLink>
            </td>
            <td className="max-w-[420px]">{commit.message}</td>
            <td>
              <Mono>{commit.author}</Mono>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export async function HackatimePanel({
  slackId,
  projectTitle,
  githubUrl,
}: {
  slackId: string | null;
  projectTitle: string;
  githubUrl: string | null;
}) {
  const report = await fetchHackatimeReport(slackId);

  if (!report.ok) {
    return (
      <EmptyState title="No Hackatime data" icon="clock">
        This user has no public Hackatime stats, or Hackatime is unreachable.
      </EmptyState>
    );
  }

  const repoName = (githubUrl ?? "").replace(/\/+$/, "").replace(/\.git$/, "").split("/").pop()?.toLowerCase() ?? "";
  const titleName = projectTitle.toLowerCase();

  return (
    <div>
      <p className="hc-caption border-b border-[var(--border)] px-4 py-3 text-sm">
        <TextLink href={`https://hackatime.hackclub.com/@${report.username}`} external>
          <Mono>@{report.username}</Mono>
        </TextLink>{" "}
        · <Mono>{report.totalText}</Mono> total across {report.projects.length} projects
      </p>
      <Table headers={["Project", "Time", "Share", ""]}>
        {report.projects.map((project) => {
          const name = project.name.toLowerCase();
          const matches = name === repoName || name === titleName;
          return (
            <tr key={project.name}>
              <td className="font-bold">{project.name}</td>
              <td>
                <Mono>{project.text}</Mono>
              </td>
              <td>
                <Muted>
                  <Mono>{project.percent.toFixed(1)}%</Mono>
                </Muted>
              </td>
              <td>{matches && <Badge tone="success">Matches this wonder</Badge>}</td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}

export function PastReviewsPanel({ reviews }: { reviews: ProjectReview[] }) {
  if (reviews.length === 0) {
    return <EmptyState title="No reviews yet" icon="history">This is the first time anyone is reviewing it.</EmptyState>;
  }

  return (
    <ul>
      {reviews.map((review) => (
        <li key={review.id} className="flex flex-col gap-3 border-b border-[var(--border)] p-4 last:border-b-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{review.pass === "first" ? "First pass" : "Second pass"}</Badge>
            {review.verdict === "approved" ? (
              <Badge tone="success">Approved</Badge>
            ) : (
              <Badge tone="danger">Changes requested</Badge>
            )}
            <Muted className="text-sm">
              by <Mono>{review.reviewed_by}</Mono> · <Mono>{formatDateTime(review.created_at)}</Mono>
            </Muted>
          </div>
          <div>
            <p className="hc-eyebrow mb-1">To the user</p>
            <p className="whitespace-pre-wrap">{review.feedback}</p>
          </div>
          {review.technical_notes && (
            <div>
              <p className="hc-eyebrow mb-1">Technical features</p>
              <p className="hc-caption whitespace-pre-wrap">{review.technical_notes}</p>
            </div>
          )}
          {review.additional_notes && (
            <div>
              <p className="hc-eyebrow mb-1">Additional notes</p>
              <p className="hc-caption whitespace-pre-wrap">{review.additional_notes}</p>
            </div>
          )}
          {review.pass === "second" && (
            <div className="flex flex-wrap gap-1">
              {SECOND_PASS_CHECKS.map((check) =>
                review.checks.includes(check.key) ? (
                  <Badge key={check.key} tone="success">✓ {check.label}</Badge>
                ) : (
                  <Badge key={check.key} tone="neutral">✗ {check.label}</Badge>
                ),
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export async function YswsPanel({
  githubUrl,
  demoUrl,
}: {
  githubUrl: string | null;
  demoUrl: string | null;
}) {
  const result = await findOtherYswsEntries({ githubUrl, demoUrl });

  if (!result.ok) {
    return (
      <EmptyState title="Couldn't reach ships.hackclub.com" icon="important">
        Try reloading in a minute.
      </EmptyState>
    );
  }

  if (result.matches.length === 0) {
    return (
      <EmptyState title="No other YSWS ships" icon="checkmark">
        Nothing on ships.hackclub.com shares this repo, demo, or GitHub user.
      </EmptyState>
    );
  }

  return (
    <Table headers={["YSWS", "Match", "Approved", "Hours", "Links"]}>
      {result.matches.map((match) => (
        <tr key={match.entry.id}>
          <td className="font-bold">{match.entry.ysws}</td>
          <td>
            {match.reason === "Same GitHub user" ? (
              <Badge tone="neutral">{match.reason}</Badge>
            ) : (
              <Badge tone="danger">{match.reason}</Badge>
            )}
          </td>
          <td>
            <Muted>
              <Mono>{match.entry.approved_at ? formatDate(match.entry.approved_at * 1000) : "—"}</Mono>
            </Muted>
          </td>
          <td>
            <Mono>{match.entry.hours ?? "—"}</Mono>
          </td>
          <td>
            <div className="flex gap-3">
              {match.entry.code_url && (
                <TextLink href={match.entry.code_url} external>
                  Code
                </TextLink>
              )}
              {match.entry.demo_url && (
                <TextLink href={match.entry.demo_url} external>
                  Demo
                </TextLink>
              )}
            </div>
          </td>
        </tr>
      ))}
    </Table>
  );
}
