import { describe, expect, test } from "bun:test";
import { absoluteImageUrl, buildAirtableFields, githubUsernameFromRepoUrl, hoursFromSeconds } from "./airtable-fields";

const base = {
  repoUrl: "https://github.com/ada/thing",
  demoUrl: "https://thing.dev",
  firstName: "Ada",
  lastName: "L",
  email: "a@b.co",
  description: "d",
  imageUrl: "",
  hours: null,
  hackatimeProjects: [],
  hackatimeRanges: "",
  submitterHackatimeId: "",
  technicalNotes: "",
  additionalNotes: "",
  birthday: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "",
  zip: "",
};

describe("airtable fields", () => {
  test("never sets an Automation field", () => {
    const fields = buildAirtableFields({
      ...base,
      hours: 3,
      imageUrl: "https://x/y.png",
      hackatimeProjects: ["a"],
      technicalNotes: "t",
      additionalNotes: "n",
      birthday: "2010-01-02",
    });
    for (const key of Object.keys(fields)) {
      expect(key.startsWith("Automation")).toBe(false);
    }
  });
  test("optional fields are omitted when empty", () => {
    const fields = buildAirtableFields(base);
    expect(fields["Optional - Override Hours Spent"]).toBeUndefined();
    expect(fields.Screenshot).toBeUndefined();
    expect(fields.Birthday).toBeUndefined();
  });
  test("hackatime ranges and id", () => {
    const fields = buildAirtableFields({
      ...base,
      hackatimeProjects: ["a"],
      hackatimeRanges: "a 7/20/2026-7/22/2026",
      submitterHackatimeId: "42",
    });
    expect(fields["Justification - Hackatime Project Name(s) + Date Range(s)"]).toBe("a 7/20/2026-7/22/2026");
    expect(fields["Justification - Submitter Hackatime ID"]).toBe("42");
    const fallback = buildAirtableFields({ ...base, hackatimeProjects: ["a", "b"] });
    expect(fallback["Justification - Hackatime Project Name(s) + Date Range(s)"]).toBe("a, b");
  });
  test("helpers", () => {
    expect(githubUsernameFromRepoUrl("https://github.com/ada/thing")).toBe("ada");
    expect(githubUsernameFromRepoUrl("https://gitlab.com/ada/thing")).toBe("");
    expect(absoluteImageUrl("/api/thumbnails/1")).toBe("https://wonders.hackclub.com/api/thumbnails/1");
    expect(hoursFromSeconds(5400)).toBe(1.5);
    expect(hoursFromSeconds(null)).toBeNull();
  });
});
