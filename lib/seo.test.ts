import { describe, expect, test } from "bun:test";
import { creativeWorkJsonLd, eventJsonLd, faqJsonLd, jsonLdScript } from "./seo";

describe("seo", () => {
  test("faq becomes question and answer pairs", () => {
    const data = faqJsonLd([{ question: "When?", answer: "January 1st" }]);
    expect(data.mainEntity[0].name).toBe("When?");
    expect(data.mainEntity[0].acceptedAnswer.text).toBe("January 1st");
  });

  test("event is free and online with iso dates", () => {
    const data = eventJsonLd();
    expect(data.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.isAccessibleForFree).toBe(true);
  });

  test("json is safe to inline in a script tag", () => {
    expect(jsonLdScript({ a: "</script><b>" })).not.toContain("</script>");
  });

  test("wonder carries its makers and links", () => {
    const data = creativeWorkJsonLd({
      id: 4,
      title: "T",
      description: "d",
      image: "https://x/y.png",
      makers: ["Ada"],
      repo: "https://github.com/a/b",
      demo: null,
    });
    expect(data.author[0].name).toBe("Ada");
    expect(data.codeRepository).toBe("https://github.com/a/b");
  });
});
