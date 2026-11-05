/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState, useTransition } from "react";

const MAX_MB = 5;
const ACCEPTED = "image/png,image/jpeg,image/webp";

export default function CardImageUpload({
  src,
  action,
  className = "",
}: {
  src: string;
  action: (formData: FormData) => Promise<string | null>;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`bigger than ${MAX_MB}MB :(`);
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("thumbnail", file);
    startTransition(async () => {
      const result = await action(formData);
      if (result) setError(result);
    });
  }

  return (
    <div className={`group ${className}`}>
      <img src={src} alt="" className="h-full w-full rounded-md object-cover" />
      <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={handleChange} />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        aria-label="change image"
        className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-md bg-black/45 font-finger-paint text-xl text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-wait disabled:opacity-100"
      >
        {pending ? "uploading... :3" : error ? error : "change image :3"}
      </button>
    </div>
  );
}
