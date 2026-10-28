"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon, { type GlyphName } from "@hackclub/icons";

export interface CommandItem {
  href: string;
  label: string;
  glyph: GlyphName;
  keywords?: string;
  count?: number;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export default function CommandBar({ items }: { items: CommandItem[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return items;
    }
    return items.filter((item) =>
      `${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(needle),
    );
  }, [items, query]);

  function show() {
    setQuery("");
    setIndex(0);
    setOpen(true);
  }

  function go(item: CommandItem | undefined) {
    if (!item) {
      return;
    }
    setOpen(false);
    router.push(item.href);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        setIndex(0);
        setOpen((value) => !value);
        return;
      }
      if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        setQuery("");
        setIndex(0);
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  return (
    <>
      <button type="button" className="hc-cmd-trigger" onClick={show}>
        <Icon glyph="search" size={18} aria-hidden />
        <span className="hc-cmd-trigger-label">Go to&hellip;</span>
        <kbd className="hc-cmd-kbd">&#8984;K</kbd>
      </button>

      {open && (
        <div className="hc-cmd-backdrop" onMouseDown={() => setOpen(false)}>
          <div
            className="hc-cmd-panel"
            role="dialog"
            aria-label="Go to"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <input
              ref={inputRef}
              className="hc-cmd-input"
              value={query}
              placeholder="Where to?"
              onChange={(event) => {
                setQuery(event.target.value);
                setIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                } else if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setIndex((value) => Math.min(value + 1, results.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setIndex((value) => Math.max(value - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  go(results[index]);
                }
              }}
            />
            <ul className="hc-cmd-list">
              {results.length === 0 && <li className="hc-cmd-empty">Nothing matches</li>}
              {results.map((item, i) => (
                <li key={item.href}>
                  <button
                    type="button"
                    className="hc-cmd-item"
                    data-active={i === index ? true : undefined}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => go(item)}
                  >
                    <Icon glyph={item.glyph} size={20} aria-hidden />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.count ? <span className="hc-nav-count">{item.count}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
