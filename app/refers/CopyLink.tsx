"use client";

import { useState } from "react";

export default function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Wonders", text: "build something wonderful and get free stickers", url });
    } catch {
      return;
    }
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-md border border-[#8C8368]/30 md:border-0 bg-[#E7E2C9] px-4 py-3 font-mono text-sm text-[#5C4A2E] outline-none focus:border-[#5C4A2E]"
      />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={copy}
          className="flex-1 rounded-md bg-[#5C4A2E] px-6 py-3 font-finger-paint text-lg text-[#E7E2C9] transition hover:-translate-y-0.5 hover:bg-[#4a3b24] sm:flex-none"
        >
          {copied ? "copied :D" : "copy link"}
        </button>
        <button
          type="button"
          onClick={share}
          className="rounded-md border-2 border-[#5C4A2E] px-5 py-3 font-finger-paint text-lg text-[#5C4A2E] transition hover:-translate-y-0.5 sm:hidden"
        >
          share
        </button>
      </div>
    </div>
  );
}
