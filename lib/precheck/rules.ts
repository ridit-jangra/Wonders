import { isIP } from "node:net";

export interface RepoRef {
  owner: string;
  repo: string;
}

const SEGMENT = /^[A-Za-z0-9._-]{1,100}$/;

export function withScheme(url: string): string {
  const trimmed = url.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function parseGithubRepo(url: string | null | undefined): RepoRef | null {
  if (!url) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(withScheme(url));
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "github.com") {
    return null;
  }
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!SEGMENT.test(owner) || !SEGMENT.test(repo)) {
    return null;
  }
  return { owner, repo };
}

export function repoKey(url: string | null | undefined): string | null {
  const ref = parseGithubRepo(url);
  return ref ? `${ref.owner}/${ref.repo}`.toLowerCase() : null;
}

export function demoKey(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(withScheme(url));
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!host.includes(".") || host === "github.com") {
    return null;
  }
  const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
  return `${host}${path}`;
}

function ipv6Bytes(address: string): number[] | null {
  let text = address.toLowerCase();
  const zone = text.indexOf("%");
  if (zone !== -1) {
    text = text.slice(0, zone);
  }

  let tail: number[] = [];
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const octets = dotted[1].split(".").map(Number);
    if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
      return null;
    }
    tail = octets;
    text = text.slice(0, text.length - dotted[1].length) + "0:0";
  }

  const halves = text.split("::");
  if (halves.length > 2) {
    return null;
  }
  const toGroups = (part: string) => (part === "" ? [] : part.split(":"));
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if ((halves.length === 1 && head.length !== 8) || missing < 0) {
    return null;
  }
  const groups = halves.length === 2 ? [...head, ...Array(missing).fill("0"), ...rest] : head;

  const bytes: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) {
      return null;
    }
    const value = parseInt(group, 16);
    bytes.push(value >> 8, value & 0xff);
  }
  if (tail.length === 4) {
    bytes.splice(12, 4, ...tail);
  }
  return bytes.length === 16 ? bytes : null;
}

function privateIpv4(a: number, b: number): boolean {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return a >= 224;
}

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address.split("%")[0]);
  if (family === 4) {
    const [a, b] = address.split(".").map(Number);
    return privateIpv4(a, b);
  }
  if (family === 6) {
    const bytes = ipv6Bytes(address);
    if (!bytes) {
      return true;
    }
    const allZeroHead = bytes.slice(0, 10).every((byte) => byte === 0);
    if (allZeroHead && bytes[10] === 0xff && bytes[11] === 0xff) {
      return privateIpv4(bytes[12], bytes[13]);
    }
    if (bytes.slice(0, 15).every((byte) => byte === 0) && (bytes[15] === 0 || bytes[15] === 1)) {
      return true;
    }
    if ((bytes[0] & 0xfe) === 0xfc) return true;
    if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true;
    return false;
  }
  return true;
}

export type RepoState = "ok" | "not_found" | "unknown";

export function classifyRepoStatus(status: number | null): RepoState {
  if (status === null) return "unknown";
  if (status >= 200 && status < 300) return "ok";
  if (status === 404 || status === 410) return "not_found";
  return "unknown";
}

export type DemoState = "ok" | "dead" | "unknown";

const DEAD_CODES = new Set(["ENOTFOUND", "ECONNREFUSED"]);

export function classifyProbe(status: number | null, code: string | null): DemoState {
  if (status !== null) {
    if (status >= 200 && status < 400) return "ok";
    if (status === 404 || status === 410) return "dead";
    return "unknown";
  }
  if (code && DEAD_CODES.has(code)) return "dead";
  return "unknown";
}

export type RequirementId = "what_it_is" | "how_to_run";

export interface Requirement {
  id: RequirementId;
  question: string;
}

export const REQUIREMENTS: Requirement[] = [
  {
    id: "what_it_is",
    question: "Does the README explain what the project is and what it does?",
  },
  {
    id: "how_to_run",
    question:
      "Does the README explain how to run it (install, build and run steps), or link to where it is hosted if it is a web app?",
  },
];

export type BlockingId = "repo_not_found" | "demo_dead" | "readme_missing" | RequirementId;

export const BLOCKING: Record<BlockingId, string> = {
  repo_not_found:
    "We couldn't find your GitHub repo. Check the link and make sure the repo is public.",
  demo_dead: "Your demo link doesn't load. Check the link and make sure the demo is live.",
  readme_missing: "Your repo has no README. Add a README.md that explains your wonder.",
  what_it_is: "Your README doesn't explain what your wonder is and what it does.",
  how_to_run: "Your README doesn't explain how to run it, or where to try it.",
};

export const HARD_CHECKS: BlockingId[] = ["repo_not_found", "demo_dead", "readme_missing"];

export interface AiRequirementAnswer {
  met: boolean;
  confident: boolean;
  evidence: string;
}

export interface AiAnswer {
  requirements: Partial<Record<RequirementId, AiRequirementAnswer>>;
  summary: string;
  review: string;
  notes: string[];
  redFlags: string[];
  strengths: string[];
}

function textList(value: unknown, max: number, length: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => String(item).trim().slice(0, length))
    .filter(Boolean)
    .slice(0, max);
}

export function parseAiAnswer(raw: string): AiAnswer | null {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    text = fence[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const incoming = (parsed.requirements ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const requirements: AiAnswer["requirements"] = {};
  for (const requirement of REQUIREMENTS) {
    const answer = incoming[requirement.id];
    if (!answer || typeof answer.met !== "boolean") {
      continue;
    }
    requirements[requirement.id] = {
      met: answer.met,
      confident: answer.confident === true,
      evidence: String(answer.evidence ?? "").slice(0, 300),
    };
  }

  return {
    requirements,
    summary: String(parsed.summary ?? "").slice(0, 600),
    review: String(parsed.review ?? "").slice(0, 4000),
    notes: textList(parsed.notes, 8, 400),
    redFlags: textList(parsed.redFlags, 8, 200),
    strengths: textList(parsed.strengths, 8, 200),
  };
}

export interface PrecheckInputs {
  repo: RepoState | "skipped";
  demo: DemoState | "skipped";
  readme: string | null | undefined;
  ai: AiAnswer | null;
}

export interface PrecheckFindings {
  blocking: BlockingId[];
  skipped: string[];
  evidence: Partial<Record<RequirementId, string>>;
}

export const MAX_AUTO_SENDBACKS = 1;

export function evaluate(input: PrecheckInputs): PrecheckFindings {
  const blocking: BlockingId[] = [];
  const skipped: string[] = [];
  const evidence: PrecheckFindings["evidence"] = {};

  if (input.repo === "not_found") {
    blocking.push("repo_not_found");
  } else if (input.repo === "unknown") {
    skipped.push("GitHub repo lookup");
  } else if (input.repo === "skipped") {
    skipped.push("not a GitHub repo");
  }

  if (input.demo === "dead") {
    blocking.push("demo_dead");
  } else if (input.demo === "unknown") {
    skipped.push("demo link check");
  }

  if (input.repo === "ok") {
    if (input.readme === null) {
      blocking.push("readme_missing");
    } else if (input.readme === undefined) {
      skipped.push("README lookup");
    }
  }

  if (typeof input.readme === "string") {
    if (!input.ai) {
      skipped.push("README content check (AI unavailable)");
    } else {
      for (const requirement of REQUIREMENTS) {
        const answer = input.ai.requirements[requirement.id];
        if (!answer) {
          continue;
        }
        if (answer.evidence) {
          evidence[requirement.id] = answer.evidence;
        }
        if (!answer.met && answer.confident) {
          blocking.push(requirement.id);
        }
      }
    }
  }

  return { blocking: [...new Set(blocking)], skipped, evidence };
}

export function shouldSendBack(blocking: BlockingId[], sendbacks: number): boolean {
  return blocking.length > 0 && sendbacks < MAX_AUTO_SENDBACKS;
}

export function reviewNoteFor(blocking: BlockingId[]): string {
  return [
    "Sent back automatically before review: your wonder is missing things every wonder needs.",
    "",
    ...blocking.map((id) => `- ${BLOCKING[id]}`),
    "",
    "Fix these and ship again. If you think this check got it wrong, ship again as it is and a person will take it from there.",
  ].join("\n");
}
