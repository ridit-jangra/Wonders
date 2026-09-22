/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";

const MAX_THUMBNAIL_MB = 5;
const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif";

export default function ThumbnailPicker({
  name = "thumbnail",
  defaultUrl = null,
  className = "",
}: {
  name?: string;
  defaultUrl?: string | null;
  className?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const preview = objectUrl ?? (removed ? null : defaultUrl);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (objectUrl) URL.revokeObjectURL(objectUrl);

    if (!file) {
      setObjectUrl(null);
      return;
    }

    if (file.size > MAX_THUMBNAIL_MB * 1024 * 1024) {
      event.target.value = "";
      setObjectUrl(null);
      setError(`that one's bigger than ${MAX_THUMBNAIL_MB}MB :(`);
      return;
    }

    setObjectUrl(URL.createObjectURL(file));
    setRemoved(false);
    setError(null);
  }

  function handleRemove() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (inputRef.current) inputRef.current.value = "";
    setObjectUrl(null);
    setRemoved(true);
    setError(null);
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="relative aspect-438/206 w-full">
        <img
          src="/project-image-fallback.png"
          alt=""
          className="absolute inset-0 h-full w-full"
        />
        {preview && (
          <img
            src={preview}
            alt=""
            className="absolute inset-[5%] h-[90%] w-[90%] rounded-sm object-cover"
          />
        )}
        <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1 px-6 text-center">
          <input
            ref={inputRef}
            type="file"
            name={name}
            accept={ACCEPTED}
            onChange={handleChange}
            className="sr-only"
          />
          <span
            className={`font-finger-paint text-lg text-[#5C4A2E] sm:text-xl md:text-2xl ${
              preview ? "rounded-md bg-[#F0EBD1]/85 px-3 py-1" : ""
            }`}
          >
            {preview ? "change it :3" : "add a thumbnail :3"}
          </span>
          {!preview && (
            <span className="font-finger-paint text-xs text-[#8C8368] sm:text-sm md:text-base">
              png, jpg, webp or gif — up to {MAX_THUMBNAIL_MB}MB
            </span>
          )}
        </label>
      </div>

      {removed && <input type="hidden" name="remove-thumbnail" value="1" />}

      <div className="flex min-h-6 items-center gap-4">
        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            className="font-finger-paint text-sm text-[#5C4A2E]/70 underline hover:text-[#5C4A2E]"
          >
            remove it :(
          </button>
        )}
        {error && (
          <p className="font-finger-paint text-sm text-[#B4524A]">{error}</p>
        )}
      </div>
    </div>
  );
}
