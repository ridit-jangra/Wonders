import { describe, expect, test } from "bun:test";
import {
  BLOCKING,
  classifyProbe,
  classifyRepoStatus,
  evaluate,
  isPrivateAddress,
  parseAiAnswer,
  parseGithubRepo,
  reviewNoteFor,
  shouldSendBack,
  type AiAnswer,
} from "./rules";

const goodAi = (over: Partial<AiAnswer["requirements"]> = {}): AiAnswer => ({
  requirements: {
    what_it_is: { met: true, confident: true, evidence: "intro paragraph" },
    how_to_run: { met: true, confident: true, evidence: "bun install" },
    ...over,
  },
  summary: "a thing",
  review: "",
  notes: [],
  redFlags: [],
  strengths: [],
});

describe("parseGithubRepo", () => {
  test("reads owner and repo", () => {
    expect(parseGithubRepo("https://github.com/ridit-jangra/Wonders")).toEqual({
      owner: "ridit-jangra",
      repo: "Wonders",
    });
  });

  test("strips .git and extra path", () => {
    expect(parseGithubRepo("https://www.github.com/a/b.git/tree/main/src")).toEqual({
      owner: "a",
      repo: "b",
    });
  });

  test("accepts links saved without a scheme", () => {
    expect(parseGithubRepo("github.com/ridit-jangra/ysws-handbook")).toEqual({
      owner: "ridit-jangra",
      repo: "ysws-handbook",
    });
  });

  test("rejects other hosts, profiles and junk", () => {
    expect(parseGithubRepo("https://gitlab.com/a/b")).toBeNull();
    expect(parseGithubRepo("https://github.com/a")).toBeNull();
    expect(parseGithubRepo("not a url")).toBeNull();
    expect(parseGithubRepo("ftp://github.com/a/b")).toBeNull();
    expect(parseGithubRepo(null)).toBeNull();
    expect(parseGithubRepo("https://github.com/a/b c")).toBeNull();
  });
});

describe("isPrivateAddress", () => {
  test("blocks loopback, private and link-local ipv4", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "0.0.0.0",
      "100.64.0.1",
      "224.0.0.1",
    ]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });

  test("allows public ipv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "140.82.112.3"]) {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  });

  test("blocks private ipv6 and mapped ipv4", () => {
    for (const ip of [
      "::1",
      "::",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "::ffff:10.0.0.1",
      "::ffff:a9fe:a9fe",
    ]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });

  test("allows public ipv6 and mapped public ipv4", () => {
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
    expect(isPrivateAddress("::ffff:8.8.8.8")).toBe(false);
  });

  test("treats garbage as blocked", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
    expect(isPrivateAddress("")).toBe(true);
  });
});

describe("classifiers", () => {
  test("repo status", () => {
    expect(classifyRepoStatus(200)).toBe("ok");
    expect(classifyRepoStatus(404)).toBe("not_found");
    expect(classifyRepoStatus(403)).toBe("unknown");
    expect(classifyRepoStatus(429)).toBe("unknown");
    expect(classifyRepoStatus(500)).toBe("unknown");
    expect(classifyRepoStatus(null)).toBe("unknown");
  });

  test("demo probe", () => {
    expect(classifyProbe(200, null)).toBe("ok");
    expect(classifyProbe(301, null)).toBe("ok");
    expect(classifyProbe(404, null)).toBe("dead");
    expect(classifyProbe(410, null)).toBe("dead");
    expect(classifyProbe(403, null)).toBe("unknown");
    expect(classifyProbe(429, null)).toBe("unknown");
    expect(classifyProbe(503, null)).toBe("unknown");
    expect(classifyProbe(null, "ENOTFOUND")).toBe("dead");
    expect(classifyProbe(null, "ECONNREFUSED")).toBe("dead");
    expect(classifyProbe(null, "ETIMEDOUT")).toBe("unknown");
    expect(classifyProbe(null, "timeout")).toBe("unknown");
    expect(classifyProbe(null, null)).toBe("unknown");
  });
});

describe("parseAiAnswer", () => {
  test("reads fenced json with surrounding text", () => {
    const raw =
      'Here you go:\n```json\n{"requirements":{"what_it_is":{"met":false,"confident":true,"evidence":"no intro"}},"summary":"s","review":"r","notes":["n"],"redFlags":["f"],"strengths":["g"]}\n```';
    const answer = parseAiAnswer(raw);
    expect(answer?.requirements.what_it_is).toEqual({
      met: false,
      confident: true,
      evidence: "no intro",
    });
    expect(answer?.summary).toBe("s");
    expect(answer?.notes).toEqual(["n"]);
    expect(answer?.redFlags).toEqual(["f"]);
    expect(answer?.strengths).toEqual(["g"]);
  });

  test("malformed answers become null or empty, never a miss", () => {
    expect(parseAiAnswer("no json here")).toBeNull();
    expect(parseAiAnswer("{ broken")).toBeNull();
    const partial = parseAiAnswer('{"requirements":{"what_it_is":{"met":"yes"}}}');
    expect(partial?.requirements.what_it_is).toBeUndefined();
  });

  test("only counts confident=true literally", () => {
    const answer = parseAiAnswer(
      '{"requirements":{"how_to_run":{"met":false,"confident":"true"}}}',
    );
    expect(answer?.requirements.how_to_run?.confident).toBe(false);
  });
});

describe("evaluate", () => {
  const base = { repo: "ok", demo: "ok", readme: "# hi", ai: goodAi() } as const;

  test("all good is clear", () => {
    const result = evaluate(base);
    expect(result.blocking).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  test("missing repo and dead demo block", () => {
    const result = evaluate({ ...base, repo: "not_found", demo: "dead", readme: undefined });
    expect(result.blocking).toEqual(["repo_not_found", "demo_dead"]);
  });

  test("missing readme blocks only when the repo exists", () => {
    expect(evaluate({ ...base, readme: null, ai: null }).blocking).toEqual(["readme_missing"]);
    expect(evaluate({ ...base, repo: "not_found", readme: null, ai: null }).blocking).toEqual([
      "repo_not_found",
    ]);
  });

  test("lookups that could not run are skipped, not blocking", () => {
    const result = evaluate({ ...base, repo: "unknown", demo: "unknown", readme: undefined, ai: null });
    expect(result.blocking).toEqual([]);
    expect(result.skipped).toContain("GitHub repo lookup");
    expect(result.skipped).toContain("demo link check");
  });

  test("a non-github repo skips the repo checks", () => {
    const result = evaluate({ ...base, repo: "skipped", readme: undefined, ai: null });
    expect(result.blocking).toEqual([]);
    expect(result.skipped).toContain("not a GitHub repo");
  });

  test("confident ai misses are always recorded", () => {
    const ai = goodAi({ what_it_is: { met: false, confident: true, evidence: "none" } });
    expect(evaluate({ ...base, ai }).blocking).toEqual(["what_it_is"]);
  });

  test("unsure ai misses never block", () => {
    const ai = goodAi({ how_to_run: { met: false, confident: false, evidence: "maybe" } });
    expect(evaluate({ ...base, ai }).blocking).toEqual([]);
  });

  test("ai unavailable is noted and does not block", () => {
    const result = evaluate({ ...base, ai: null });
    expect(result.blocking).toEqual([]);
    expect(result.skipped).toContain("README content check (AI unavailable)");
  });

  test("evidence is collected", () => {
    expect(evaluate(base).evidence.what_it_is).toBe("intro paragraph");
  });
});

describe("shouldSendBack", () => {
  test("nothing missing never sends back", () => {
    expect(shouldSendBack([], 0)).toBe(false);
  });

  test("any miss sends back once", () => {
    expect(shouldSendBack(["repo_not_found"], 0)).toBe(true);
    expect(shouldSendBack(["demo_dead"], 0)).toBe(true);
    expect(shouldSendBack(["what_it_is"], 0)).toBe(true);
    expect(shouldSendBack(["how_to_run", "what_it_is"], 0)).toBe(true);
  });

  test("after one send back a person decides", () => {
    expect(shouldSendBack(["repo_not_found"], 1)).toBe(false);
    expect(shouldSendBack(["demo_dead", "what_it_is"], 1)).toBe(false);
    expect(shouldSendBack(["readme_missing"], 2)).toBe(false);
  });
});

describe("reviewNoteFor", () => {
  test("lists the fixed labels and nothing model-written", () => {
    const note = reviewNoteFor(["repo_not_found", "how_to_run"]);
    expect(note).toContain(BLOCKING.repo_not_found);
    expect(note).toContain(BLOCKING.how_to_run);
    expect(note).toContain("ship again");
  });
});
