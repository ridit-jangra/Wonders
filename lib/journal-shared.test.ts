import { describe, expect, test } from "bun:test";
import {
  applyFormat,
  continueList,
  insertImage,
  isAllowedImageSrc,
  journalTextLength,
  stripDisallowedImages,
} from "./journal-shared";

describe("applyFormat", () => {
  test("wraps a selection and toggles it off again", () => {
    const wrapped = applyFormat("a word b", 2, 6, "bold");
    expect(wrapped.value).toBe("a **word** b");
    expect(wrapped.value.slice(wrapped.start, wrapped.end)).toBe("word");
    const undone = applyFormat(wrapped.value, wrapped.start, wrapped.end, "bold");
    expect(undone.value).toBe("a word b");
  });

  test("inserts a placeholder with nothing selected", () => {
    const result = applyFormat("", 0, 0, "italic");
    expect(result.value).toBe("*italic*");
    expect(result.value.slice(result.start, result.end)).toBe("italic");
  });

  test("code is inline for one line and fenced for several", () => {
    expect(applyFormat("x", 0, 1, "code").value).toBe("`x`");
    expect(applyFormat("a\nb", 0, 3, "code").value).toBe("```\na\nb\n```");
  });

  test("links wrap a url or a label", () => {
    expect(applyFormat("https://x.dev", 0, 13, "link").value).toBe("[link](https://x.dev)");
    expect(applyFormat("hi", 0, 2, "link").value).toBe("[hi](https://)");
  });

  test("line formats apply to every selected line and toggle off", () => {
    const list = applyFormat("a\nb", 0, 3, "list");
    expect(list.value).toBe("- a\n- b");
    expect(applyFormat(list.value, list.start, list.end, "list").value).toBe("a\nb");
    expect(applyFormat("a\nb", 0, 3, "numbered").value).toBe("1. a\n2. b");
    expect(applyFormat("a", 0, 0, "heading").value).toBe("## a");
    expect(applyFormat("a", 0, 0, "quote").value).toBe("> a");
  });

  test("a plain caret stays after the prefix instead of selecting it", () => {
    const fresh = applyFormat("intro\n", 6, 6, "list");
    expect(fresh.value).toBe("intro\n- ");
    expect([fresh.start, fresh.end]).toEqual([8, 8]);
    const mid = applyFormat("abc", 3, 3, "heading");
    expect([mid.value, mid.start, mid.end]).toEqual(["## abc", 6, 6]);
    const off = applyFormat("- abc", 5, 5, "list");
    expect([off.value, off.start, off.end]).toEqual(["abc", 3, 3]);
  });
});

describe("continueList", () => {
  test("continues bullets and numbers", () => {
    expect(continueList("- one", 5)?.value).toBe("- one\n- ");
    expect(continueList("1. one", 6)?.value).toBe("1. one\n2. ");
  });

  test("an empty item leaves the list", () => {
    expect(continueList("- one\n- ", 8)?.value).toBe("- one\n");
  });

  test("plain lines are left alone", () => {
    expect(continueList("hello", 5)).toBeNull();
  });
});

describe("images", () => {
  test("only our own storage and the hack club cdn are allowed", () => {
    expect(isAllowedImageSrc("/api/thumbnails/abc")).toBe(true);
    expect(isAllowedImageSrc("https://cdn.hackclub.com/x/y.png")).toBe(true);
    expect(isAllowedImageSrc("https://evil.example/pixel.png")).toBe(false);
    expect(isAllowedImageSrc("https://cdn.hackclub.com.evil.example/x.png")).toBe(false);
    expect(isAllowedImageSrc("")).toBe(false);
    expect(isAllowedImageSrc(null)).toBe(false);
  });

  test("other images are stripped before saving", () => {
    const content = "a ![ok](/api/thumbnails/1) b ![bad](https://evil.example/p.png) c";
    expect(stripDisallowedImages(content)).toBe("a ![ok](/api/thumbnails/1) b [image removed: bad] c");
  });

  test("insertImage starts a new line and moves the caret past it", () => {
    const result = insertImage("hello", 5, "/api/thumbnails/1");
    expect(result.value).toBe("hello\n![screenshot](/api/thumbnails/1)\n");
    expect(result.start).toBe(result.value.length);
  });

  test("text length ignores image markdown", () => {
    expect(journalTextLength("![a](/x)")).toBe(0);
    expect(journalTextLength("hi ![a](/x)")).toBe(2);
  });
});
