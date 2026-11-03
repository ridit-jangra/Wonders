"use client";

import { useState } from "react";

export default function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="rounded-md bg-[#D1E4B5] px-3 py-1 font-finger-paint text-sm text-black/50 transition hover:scale-105"
    >
      {copied ? "copied :D" : "copy"}
    </button>
  );
}
