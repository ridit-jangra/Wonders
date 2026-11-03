/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

export default function ReasonDialogButton({
  action,
  label,
  prompt,
  confirmLabel,
  pendingLabel,
  placeholder = "why?",
  className,
  minLength = 5,
}: {
  action: (reason: string) => Promise<{ ok: boolean; error?: string }>;
  label: string;
  prompt: string;
  confirmLabel: string;
  pendingLabel: string;
  placeholder?: string;
  className?: string;
  minLength?: number;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, pending]);

  function close() {
    setOpen(false);
    setError("");
  }

  function confirm() {
    const trimmed = reason.trim();
    if (trimmed.length < minLength) {
      setError(`write at least ${minLength} characters :3`);
      return;
    }
    startTransition(async () => {
      const result = await action(trimmed);
      if (!result.ok) {
        setError(result.error ?? "that didn't work :(");
        return;
      }
      setReason("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="relative aspect-758/537 w-full max-w-xl"
            >
              <img src="/dialog-box-template.png" alt="" className="absolute inset-0 h-full w-full" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-[12%] py-[9%] text-center">
                <p className="font-finger-paint text-base text-[#5C4A2E] sm:text-lg">{prompt}</p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={placeholder}
                  rows={3}
                  maxLength={1000}
                  disabled={pending}
                  className="w-full resize-none rounded-md bg-[#E7E2C9] px-3 py-2 font-finger-paint text-sm text-[#5C4A2E] placeholder:text-[#8C8368] focus:outline-none"
                />
                {error && <p className="font-finger-paint text-sm text-[#A33B32]">{error}</p>}
                <div className="flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={close}
                    disabled={pending}
                    className="rounded-lg bg-[#D0E4B4] px-4 py-2 font-finger-paint text-black/60 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    nevermind :3
                  </button>
                  <button
                    type="button"
                    onClick={confirm}
                    disabled={pending}
                    className="rounded-lg bg-[#F2B3AD] px-4 py-2 font-finger-paint text-black/60 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pending ? pendingLabel : confirmLabel}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
