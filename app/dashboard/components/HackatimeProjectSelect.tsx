"use client";

import { useEffect, useId, useRef, useState } from "react";
import Icon from "@hackclub/icons";

export default function HackatimeProjectSelect({
  name = "hackatime-projects",
  options,
  defaultSelected = [],
  disabled = false,
  className = "",
}: {
  name?: string;
  options: string[];
  defaultSelected?: string[];
  disabled?: boolean;
  className?: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const visible = options.filter((option) =>
    option.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function handlePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open]);

  function toggle(option: string) {
    setSelected((current) =>
      current.includes(option)
        ? current.filter((value) => value !== option)
        : [...current, option],
    );
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (visible[active]) toggle(visible[active]);
    }
  }

  return (
    <div ref={rootRef} className={`relative w-full ${className}`} onKeyDown={handleKeyDown}>
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((value) => !value);
          setQuery("");
          setActive(0);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className="flex min-h-12 w-full items-center gap-2 border border-[#8C8368]/30 bg-[#F0EBD1] px-4 py-2 text-left font-finger-paint text-base text-[#5C4A2E] transition-colors hover:bg-[#F6F2DE] focus:border-[#8C8368] focus:outline-none disabled:cursor-not-allowed disabled:hover:bg-[#F0EBD1]"
      >
        <span className="flex flex-1 flex-wrap gap-2">
          {selected.length === 0 ? (
            <span className="text-[#8C8368]">pick a hackatime project :3</span>
          ) : (
            selected.map((value) => (
              <span
                key={value}
                className="rounded-md bg-[#D1E4B5] px-2 py-0.5 text-sm text-[#5C4A2E]"
              >
                {value}
              </span>
            ))
          )}
        </span>
        <Icon
          glyph="down-caret"
          size={28}
          aria-hidden
          className={`shrink-0 text-[#8C8368] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 border border-[#8C8368]/40 bg-[#F0EBD1] shadow-[3px_4px_0_rgba(92,74,46,0.25)]">
          {options.length > 6 && (
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              placeholder="search your projects..."
              className="w-full border-b border-[#8C8368]/30 bg-[#E7E2C9] px-4 py-2 font-finger-paint text-sm text-[#5C4A2E] placeholder:text-[#8C8368] focus:outline-none"
            />
          )}
          <ul
            id={listId}
            role="listbox"
            aria-multiselectable
            tabIndex={-1}
            ref={(list) => {
              if (list && options.length <= 6) list.focus();
            }}
            className="max-h-60 overflow-y-auto py-1 focus:outline-none"
          >
            {visible.length === 0 ? (
              <li className="px-4 py-2 font-finger-paint text-sm text-[#8C8368]">
                nothing matches :(
              </li>
            ) : (
              visible.map((option, index) => {
                const isSelected = selected.includes(option);
                return (
                  <li
                    key={option}
                    role="option"
                    aria-selected={isSelected}
                    onPointerEnter={() => setActive(index)}
                    onClick={() => toggle(option)}
                    className={`flex cursor-pointer items-center gap-3 px-4 py-2 font-finger-paint text-[#5C4A2E] ${
                      index === active ? "bg-[#E7E2C9]" : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-[#8C8368]/60 text-[#5C4A2E] ${
                        isSelected ? "bg-[#D1E4B5]" : "bg-[#F6F2DE]"
                      }`}
                    >
                      {isSelected && <Icon glyph="checkmark" size={20} aria-hidden />}
                    </span>
                    <span className="truncate">{option}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
