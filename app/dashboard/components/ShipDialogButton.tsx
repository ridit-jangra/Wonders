/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import LinkButton from "@/app/components/LinkButton";
import { AnimatePresence, motion } from "framer-motion";
import { findCountry, normalizePhone, DEFAULT_COUNTRY } from "@/lib/phone";
import CountrySelect from "./CountrySelect";
import SubmitButton from "./SubmitButton";

export default function ShipDialogButton({
  shipAction,
  isReship,
  shipMore = false,
  confirmOnly = false,
  disabled,
  initialIso,
  initialNumber,
  fromAuth,
  teammates = [],
  className,
}: {
  shipAction: (formData: FormData) => void;
  isReship: boolean;
  shipMore?: boolean;
  confirmOnly?: boolean;
  disabled: boolean;
  initialIso: string;
  initialNumber: string;
  fromAuth: boolean;
  teammates?: { profileId: string; name: string; hasPhone: boolean }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [iso, setIso] = useState(findCountry(initialIso) ? initialIso : DEFAULT_COUNTRY);
  const [number, setNumber] = useState(initialNumber);
  const [mates, setMates] = useState<Record<string, { iso: string; number: string }>>({});
  const mateEntry = (id: string) => mates[id] ?? { iso: DEFAULT_COUNTRY, number: "" };
  const askMates = teammates.filter((mate) => !mate.hasPhone);
  const matesValid = askMates.every((mate) => {
    const entry = mateEntry(mate.profileId);
    return entry.number.trim() === "" || normalizePhone(entry.iso, entry.number) !== null;
  });
  const valid = confirmOnly || (normalizePhone(iso, number) !== null && matesValid);
  const roomy = teammates.length > 0;

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
            className="fixed inset-0 z-50 flex overflow-y-auto bg-black/40 px-4 py-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className={`relative m-auto w-full max-w-xl ${roomy ? "" : "aspect-758/537"}`}
            >
              <img src="/dialog-box-template.png" alt="" className="absolute inset-0 h-full w-full" />
              <div
                className={`flex flex-col items-center gap-2 px-[11%] text-center sm:gap-3 ${
                  roomy ? "relative py-[12%]" : "absolute inset-0 justify-center py-[8%]"
                }`}
              >
                {confirmOnly && (
                  <>
                    <p className="font-finger-paint text-base text-[#5C4A2E] sm:text-lg">
                      ship it for the team? :3
                    </p>
                    <p className="font-finger-paint text-xs text-[#5C4A2E]/70 sm:text-sm">
                      this sends the wonder for review on behalf of everyone on it.
                    </p>
                  </>
                )}
                {!confirmOnly && (<>
                <p className="font-finger-paint text-base text-[#5C4A2E] sm:text-lg">
                  where can we reach you? :3
                </p>
                <p className="font-finger-paint text-xs text-[#5C4A2E]/70 sm:text-sm">
                  {fromAuth && initialNumber
                    ? "this number came from Hack Club Auth and might be old. give us a new one if it changed!"
                    : "we need a phone number for shipping. it can be a new one, not just the one on your Hack Club Auth account!"}
                </p>
                <p className="font-finger-paint text-xs text-[#5C4A2E]/70 sm:text-sm">
                  you can also update it anytime in your{" "}
                  <LinkButton href="/dashboard/profile" newTab>
                    account settings
                  </LinkButton>
                  .
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
                {normalizePhone(iso, number) === null && number.trim() !== "" && (
                  <p className="font-finger-paint text-xs text-[#A33B32]">that doesn&apos;t look like a phone number yet :c</p>
                )}
                {!confirmOnly && teammates.length > 0 && (
                  <div className="flex w-full flex-col gap-2 border-t border-[#5C4A2E]/15 pt-3 text-left">
                    <p className="font-finger-paint text-xs text-[#5C4A2E] sm:text-sm">
                      your teammates need a phone number for their surprise too :3 add theirs if you know it. don&apos;t
                      know it? ask them!
                    </p>
                    {teammates.map((mate) =>
                      mate.hasPhone ? (
                        <p key={mate.profileId} className="font-finger-paint text-xs text-[#5C4A2E]/70 sm:text-sm">
                          {mate.name} already added theirs :D
                        </p>
                      ) : (
                        <div key={mate.profileId} className="flex flex-col gap-1">
                          <p className="font-finger-paint text-xs text-[#5C4A2E] sm:text-sm">{mate.name}</p>
                          <div className="flex w-full items-stretch gap-2">
                            <CountrySelect
                              value={mateEntry(mate.profileId).iso}
                              onChange={(next) =>
                                setMates((all) => ({
                                  ...all,
                                  [mate.profileId]: { ...mateEntry(mate.profileId), iso: next },
                                }))
                              }
                            />
                            <input type="hidden" name={`mate_country_${mate.profileId}`} value={mateEntry(mate.profileId).iso} />
                            <input
                              name={`mate_phone_${mate.profileId}`}
                              type="tel"
                              inputMode="tel"
                              value={mateEntry(mate.profileId).number}
                              onChange={(e) =>
                                setMates((all) => ({
                                  ...all,
                                  [mate.profileId]: { ...mateEntry(mate.profileId), number: e.target.value },
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              maxLength={20}
                              placeholder={`${mate.name}'s number (optional)`}
                              className="min-w-0 flex-1 rounded-md bg-[#E7E2C9] px-3 py-2 font-finger-paint text-base text-[#5C4A2E] placeholder:text-[#8C8368] focus:outline-none"
                            />
                          </div>
                          {mateEntry(mate.profileId).number.trim() !== "" &&
                            normalizePhone(mateEntry(mate.profileId).iso, mateEntry(mate.profileId).number) === null && (
                              <p className="font-finger-paint text-xs text-[#A33B32]">
                                that doesn&apos;t look like a phone number yet :c
                              </p>
                            )}
                        </div>
                      ),
                    )}
                  </div>
                )}
                </>)}
                <div className="flex justify-center gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-[#D0E4B4] px-4 py-2 font-finger-paint text-black/60 transition-all hover:zoom-110"
                  >
                    nevermind :3
                  </button>
                  <SubmitButton
                    formAction={shipAction}
                    disabled={!valid}
                    pendingLabel={`${verb}ping it... :3`}
                    className="rounded-lg bg-[#A8C7E0] px-4 py-2 font-finger-paint text-black/60 transition-all hover:zoom-110"
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
