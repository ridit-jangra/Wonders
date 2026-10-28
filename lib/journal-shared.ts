export const JOURNAL_MAX_TITLE = 120;
export const JOURNAL_MAX_CONTENT = 5000;
export const JOURNAL_MAX_ENTRIES = 200;

export function isAllowedImageSrc(src: string | undefined | null): boolean {
  if (!src) return false;
  return src.startsWith("/api/thumbnails/") || src.startsWith("https://cdn.hackclub.com/");
}

export type FormatAction = "bold" | "italic" | "heading" | "list" | "numbered" | "quote" | "code" | "link";

export interface EditResult {
  value: string;
  start: number;
  end: number;
}

function lineStartOf(value: string, index: number) {
  return value.lastIndexOf("\n", index - 1) + 1;
}

function wrap(value: string, start: number, end: number, left: string, right: string, placeholder: string): EditResult {
  const selected = value.slice(start, end);
  if (selected.startsWith(left) && selected.endsWith(right) && selected.length >= left.length + right.length) {
    const inner = selected.slice(left.length, selected.length - right.length);
    return { value: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length };
  }
  const before = value.slice(start - left.length, start);
  const after = value.slice(end, end + right.length);
  if (selected && before === left && after === right) {
    return {
      value: value.slice(0, start - left.length) + selected + value.slice(end + right.length),
      start: start - left.length,
      end: end - left.length,
    };
  }
  const inner = selected || placeholder;
  const next = value.slice(0, start) + left + inner + right + value.slice(end);
  return { value: next, start: start + left.length, end: start + left.length + inner.length };
}

function prefixLines(value: string, start: number, end: number, prefix: (index: number) => string, matcher: RegExp): EditResult {
  const first = lineStartOf(value, start);
  const lastBreak = value.indexOf("\n", end);
  const last = lastBreak === -1 ? value.length : lastBreak;
  const lines = value.slice(first, last).split("\n");
  const allPrefixed = lines.every((line) => matcher.test(line));
  const next = lines.map((line, index) => (allPrefixed ? line.replace(matcher, "") : prefix(index) + line));
  const block = next.join("\n");
  const merged = value.slice(0, first) + block + value.slice(last);
  if (start === end) {
    const caret = Math.max(first, start + (next[0].length - lines[0].length));
    return { value: merged, start: caret, end: caret };
  }
  return { value: merged, start: first, end: first + block.length };
}

export function applyFormat(value: string, start: number, end: number, action: FormatAction): EditResult {
  switch (action) {
    case "bold":
      return wrap(value, start, end, "**", "**", "bold");
    case "italic":
      return wrap(value, start, end, "*", "*", "italic");
    case "code": {
      const selected = value.slice(start, end);
      return selected.includes("\n")
        ? wrap(value, start, end, "```\n", "\n```", "code")
        : wrap(value, start, end, "`", "`", "code");
    }
    case "link": {
      const selected = value.slice(start, end);
      if (/^https?:\/\//i.test(selected)) {
        const next = value.slice(0, start) + `[link](${selected})` + value.slice(end);
        return { value: next, start: start + 1, end: start + 5 };
      }
      const label = selected || "text";
      const next = value.slice(0, start) + `[${label}](https://)` + value.slice(end);
      const urlStart = start + label.length + 3;
      return { value: next, start: urlStart, end: urlStart + 8 };
    }
    case "heading":
      return prefixLines(value, start, end, () => "## ", /^#{1,3} /);
    case "list":
      return prefixLines(value, start, end, () => "- ", /^[-*] /);
    case "numbered":
      return prefixLines(value, start, end, (index) => `${index + 1}. `, /^\d+\. /);
    case "quote":
      return prefixLines(value, start, end, () => "> ", /^> ?/);
  }
}

export function continueList(value: string, caret: number): EditResult | null {
  const first = lineStartOf(value, caret);
  const line = value.slice(first, caret);
  const match = line.match(/^(\s*)([-*]|\d+\.|>) (.*)$/);
  if (!match) return null;
  const [, indent, marker, rest] = match;
  if (rest.trim() === "") {
    const next = value.slice(0, first) + value.slice(caret);
    return { value: next, start: first, end: first };
  }
  const nextMarker = /^\d+\.$/.test(marker) ? `${parseInt(marker, 10) + 1}.` : marker;
  const insert = `\n${indent}${nextMarker} `;
  const next = value.slice(0, caret) + insert + value.slice(caret);
  const position = caret + insert.length;
  return { value: next, start: position, end: position };
}

export function insertImage(value: string, caret: number, url: string, alt = "screenshot"): EditResult {
  const lead = caret > 0 && value[caret - 1] !== "\n" ? "\n" : "";
  const markdown = `${lead}![${alt}](${url})\n`;
  const next = value.slice(0, caret) + markdown + value.slice(caret);
  const position = caret + markdown.length;
  return { value: next, start: position, end: position };
}

export function swapText(
  value: string,
  token: string,
  replacement: string,
  selStart: number,
  selEnd: number,
): EditResult | null {
  const index = value.indexOf(token);
  if (index === -1) return null;
  const tokenEnd = index + token.length;
  const delta = replacement.length - token.length;
  const move = (position: number) =>
    position >= tokenEnd ? position + delta : position > index ? index + replacement.length : position;
  return {
    value: value.slice(0, index) + replacement + value.slice(tokenEnd),
    start: move(selStart),
    end: move(selEnd),
  };
}

export function stripDisallowedImages(content: string): string {
  return content.replace(/!\[([^\]]*)\]\(([^)\s]*)[^)]*\)/g, (whole, alt: string, src: string) =>
    isAllowedImageSrc(src) ? whole : `[image removed: ${alt || "link"}]`,
  );
}

export function journalTextLength(content: string): number {
  return content.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim().length;
}
