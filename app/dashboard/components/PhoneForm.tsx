"use client";

import { useState } from "react";
import { DEFAULT_COUNTRY, findCountry, normalizePhone } from "@/lib/phone";
import CountrySelect from "./CountrySelect";
import SubmitButton from "./SubmitButton";

export default function PhoneForm({
  action,
  initialIso,
  initialNumber,
  fromAuth,
}: {
  action: (formData: FormData) => void;
  initialIso: string;
  initialNumber: string;
  fromAuth: boolean;
}) {
  const [iso, setIso] = useState(findCountry(initialIso) ? initialIso : DEFAULT_COUNTRY);
  const [number, setNumber] = useState(initialNumber);
  const valid = normalizePhone(iso, number) !== null;

  return (
    <form action={action} className="mt-4 flex flex-col gap-2 border-t border-[#8C8368]/20 pt-4">
      <p className="font-finger-paint text-sm text-[#5C4A2E]/70">phone number</p>
      <p className="font-finger-paint text-xs text-[#5C4A2E]/60">
        {fromAuth && initialNumber
          ? "this came from Hack Club Auth and might be old. add a new one if it changed :3"
          : "this is where we reach you for shipping. change it anytime :3"}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <CountrySelect value={iso} onChange={setIso} />
        <input type="hidden" name="phone_country" value={iso} />
        <input
          name="phone_number"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          maxLength={20}
          placeholder="phone number"
          className="min-w-0 flex-1 bg-[#F0EBD1] px-3 py-2 font-finger-paint text-base text-[#5C4A2E] placeholder:text-[#8C8368] focus:outline-none"
        />
        <SubmitButton
          disabled={!valid}
          pendingLabel="saving... :3"
          className="rounded-md bg-[#D1E4B5] px-4 py-2 font-finger-paint text-lg text-black/40 hover:zoom-110 transition-all"
        >
          Save :3
        </SubmitButton>
      </div>
      {!valid && number.trim() !== "" && (
        <p className="font-finger-paint text-xs text-[#A33B32]">that doesn&apos;t look like a phone number yet :c</p>
      )}
    </form>
  );
}
