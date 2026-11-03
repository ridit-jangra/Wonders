/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { findCountry, normalizePhone, DEFAULT_COUNTRY } from "@/lib/phone";
import CountrySelect from "./CountrySelect";
import SubmitButton from "./SubmitButton";

export default function ShipDialogButton({
  shipAction,
  isReship,
  shipMore = false,
  disabled,
  initialIso,
  initialNumber,
  fromAuth,
  className,
}: {
  shipAction: (formData: FormData) => void;
  isReship: boolean;
  shipMore?: boolean;
  disabled: boolean;
  initialIso: string;
  initialNumber: string;
  fromAuth: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [iso, setIso] = useState(findCountry(initialIso) ? initialIso : DEFAULT_COUNTRY);
  const [number, setNumber] = useState(initialNumber);
  const valid = normalizePhone(iso, number) !== null;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const verb = isReship && !shipMore ? "reship" : "ship";

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
        {shipMore ? "Ship again :D" : isReship ? "Reship it :D" : "Ship it :D"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="relative aspect-758/537 w-full max-w-xl"
            >
              <img src="/dialog-box-template.png" alt="" className="absolute inset-0 h-full w-full" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-[11%] py-[8%] text-center sm:gap-3">
                <p className="font-finger-paint text-base text-[#5C4A2E] sm:text-lg">
                  where can we reach you? :3
                </p>
                <p className="font-finger-paint text-xs text-[#5C4A2E]/70 sm:text-sm">
                  {fromAuth && initialNumber
                    ? "this number came from Hack Club Auth and might be old. give us a new one if it changed!"
                    : "we need a phone number for shipping. it can be a new one, not just the one on your Hack Club Auth account!"}
                </p>
                <div className="flex w-full items-stretch gap-2">
                  <CountrySelect value={iso} onChange={setIso} />
                  <input type="hidden" name="phone_country" value={iso} />
                  <input
                    name="phone_number"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    maxLength={20}
                    placeholder="phone number"
                    className="min-w-0 flex-1 rounded-md bg-[#E7E2C9] px-3 py-2 font-finger-paint text-base text-[#5C4A2E] placeholder:text-[#8C8368] focus:outline-none"
                  />
                </div>
                {!valid && number.trim() !== "" && (
                  <p className="font-finger-paint text-xs text-[#A33B32]">that doesn&apos;t look like a phone number yet :c</p>
                )}
                <div className="flex justify-center gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-[#D0E4B4] px-4 py-2 font-finger-paint text-black/60 transition hover:scale-105"
                  >
                    nevermind :3
                  </button>
                  <SubmitButton
                    formAction={shipAction}
                    disabled={!valid}
                    pendingLabel={`${verb}ping it... :3`}
                    className="rounded-lg bg-[#A8C7E0] px-4 py-2 font-finger-paint text-black/60 transition hover:scale-105"
                  >
                    {verb} it :D
                  </SubmitButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
