/* eslint-disable @next/next/no-img-element */
"use client";

import { useActionState, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { joinWonder, type JoinState } from "@/app/dashboard/actions";
import SubmitButton from "./SubmitButton";

const INITIAL: JoinState = {};

function formatCode(value: string) {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

export default function JoinWonderButton({
  className,
  children = "Join a wonder",
  onOpenAction,
}: {
  className?: string;
  children?: React.ReactNode;
  onOpenAction?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [state, formAction] = useActionState(joinWonder, INITIAL);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`cursor-pointer ${className ?? ""}`}
        onClick={() => {
          onOpenAction?.();
          setOpen(true);
        }}
      >
        {children}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
          >
            <motion.form
              action={formAction}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="relative aspect-758/537 w-full max-w-xl"
            >
              <img src="/dialog-box-template.png" alt="" className="absolute inset-0 h-full w-full" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-[11%] py-[8%] text-center sm:gap-3">
                <p className="font-finger-paint text-base text-[#5C4A2E] sm:text-lg">join a wonder :D</p>
                <p className="font-finger-paint text-xs text-[#5C4A2E]/70 sm:text-sm">
                  got a code from a friend? pop it in to join their wonder.
                </p>
                <input
                  name="code"
                  value={code}
                  onChange={(e) => setCode(formatCode(e.target.value))}
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="ABCD-EFGH"
                  maxLength={9}
                  className="w-full max-w-[16rem] rounded-md bg-[#E7E2C9] px-3 py-2 text-center font-mono text-lg tracking-widest text-[#5C4A2E] placeholder:text-[#8C8368] focus:outline-none"
                />
                {state.error && (
                  <p className="font-finger-paint text-xs text-[#A33B32]">{state.error}</p>
                )}
                <div className="flex justify-center gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-[#D0E4B4] px-4 py-2 font-finger-paint text-black/60 transition-all hover:zoom-110"
                  >
                    nevermind :3
                  </button>
                  <SubmitButton
                    disabled={code.replace("-", "").length !== 8}
                    pendingLabel="joining... :3"
                    className="rounded-lg bg-[#A8C7E0] px-4 py-2 font-finger-paint text-black/60 transition-all hover:zoom-110"
                  >
                    join :D
                  </SubmitButton>
                </div>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
