/* eslint-disable @next/next/no-img-element */
import type { TimelineEntry } from "@/lib/project-history";
import type { SlackActor } from "@/lib/profiles";
import LocalTime from "./LocalTime";

type Tone = "neutral" | "progress" | "warn" | "success";

const TONE: Record<Tone, string> = {
  neutral: "border border-[#8C8368]/40 bg-[#F0EBD1] text-[#5C4A2E]",
  progress: "bg-[#F0E27D] text-[#16213E]",
  warn: "bg-[#F2B3AD] text-[#5C2A25]",
  success: "bg-[#D1E4B5] text-[#2F4A1F]",
};

function describe(entry: TimelineEntry): { tag: string; tone: Tone } | null {
  switch (entry.toStatus) {
    case "in_review":
      return {
        tag: entry.fromStatus === "rejected" ? "resubmitted" : "submitted",
        tone: "neutral",
      };
    case "second_pass":
      return { tag: "passed first review", tone: "progress" };
    case "rejected":
      return { tag: "changes requested", tone: "warn" };
    case "approved":
    case "shipped":
      return { tag: "approved", tone: "success" };
    case "fulfillment_started":
      return { tag: "reward incoming", tone: "success" };
    case "fulfilled":
      return { tag: "wonder complete", tone: "success" };
    case "building":
      return { tag: "back to building", tone: "neutral" };
    default:
      return null;
  }
}

interface Row {
  key: string;
  actorSlackId: string;
  tag: string;
  tone: Tone;
  note: string | null;
  at: string;
}

function Avatar({ actor }: { actor: SlackActor | undefined }) {
  if (actor?.avatarUrl) {
    return (
      <img
        src={actor.avatarUrl}
        alt=""
        className="size-7 shrink-0 rounded-full border border-[#8C8368]/30 object-cover"
      />
    );
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#D1E4B5] font-finger-paint text-sm text-[#5C4A2E]">
      {(actor?.name ?? "?").replace(/^@/, "").charAt(0).toUpperCase()}
    </span>
  );
}

export default function ProjectTimeline({
  entries,
  actors,
  ownerSlackId,
  startedAt,
}: {
  entries: TimelineEntry[];
  actors: Record<string, SlackActor>;
  ownerSlackId: string;
  startedAt: string;
}) {
  const rows: Row[] = [
    {
      key: "started",
      actorSlackId: ownerSlackId,
      tag: "started",
      tone: "neutral",
      note: null,
      at: startedAt,
    },
  ];

  for (const entry of entries) {
    const described = describe(entry);
    if (!described) continue;
    rows.push({
      key: entry.id,
      actorSlackId: entry.actorSlackId,
      tag: described.tag,
      tone: described.tone,
      note: entry.note?.trim() || null,
      at: entry.createdAt,
    });
  }

  return (
    <section className="flex w-full flex-col gap-3 md:max-w-[90%]">
      <h2 className="font-finger-paint text-2xl text-[#5C4A2E]">timeline</h2>
      <ol className="flex flex-col gap-2">
        {rows.map((row) => {
          const actor = actors[row.actorSlackId];
          return (
            <li key={row.key} className="rounded-md bg-[#E7E2C9] px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Avatar actor={actor} />
                <span className="font-finger-paint text-base text-[#5C4A2E]">
                  @{(actor?.name ?? row.actorSlackId).replace(/^@/, "")}
                </span>
                <span
                  className={`rounded-full px-3 py-0.5 font-finger-paint text-sm ${TONE[row.tone]}`}
                >
                  {row.tag}
                </span>
                <LocalTime
                  iso={row.at}
                  className="ml-auto font-finger-paint text-sm text-[#8C8368]"
                />
              </div>
              {row.note && (
                <p className="mt-2 whitespace-pre-wrap font-finger-paint text-base text-[#5C4A2E]">
                  {row.note}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
