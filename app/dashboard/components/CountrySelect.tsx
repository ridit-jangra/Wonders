"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, findCountry } from "@/lib/phone";

export default function CountrySelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = findCountry(value) ?? COUNTRIES[0];

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.startsWith(q) || c.iso.toLowerCase() === q,
    );
  }, [query]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-full items-center gap-2 rounded-md bg-[#E7E2C9] px-3 py-2 font-finger-paint text-base text-[#5C4A2E] transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-lg leading-none">{selected.flag}</span>
        <span>+{selected.dial}</span>
        <span className="text-xs text-[#8C8368]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-md bg-[#F0EBD1] p-2 shadow-lg ring-1 ring-[#8C8368]/30">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (matches[0]) {
                  onChange(matches[0].iso);
                  setOpen(false);
                  setQuery("");
                }
              }
            }}
            placeholder="search a country :3"
            className="w-full rounded-md bg-[#E7E2C9] px-3 py-2 font-finger-paint text-sm text-[#5C4A2E] placeholder:text-[#8C8368] focus:outline-none"
          />
          <ul role="listbox" className="wonders-scroll mt-2 max-h-48 overflow-y-auto">
            {matches.map((country) => (
              <li key={country.iso} role="option" aria-selected={country.iso === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(country.iso);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-finger-paint text-sm text-[#5C4A2E] transition hover:bg-[#D1E4B5] ${
                    country.iso === value ? "bg-[#D1E4B5]/70" : ""
                  }`}
                >
                  <span className="text-base leading-none">{country.flag}</span>
                  <span className="min-w-0 flex-1 truncate">{country.name}</span>
                  <span className="text-[#8C8368]">+{country.dial}</span>
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-2 py-3 text-center font-finger-paint text-sm text-[#8C8368]">nothing found :(</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
