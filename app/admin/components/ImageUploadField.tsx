/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Field, Input } from "./ui";

const MAX_BYTES = 5 * 1024 * 1024;

export default function ImageUploadField({ defaultValue }: { defaultValue: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function clear() {
    if (fileRef.current) fileRef.current.value = "";
    setFileName("");
    setPreview("");
    setError("");
  }

  function onPick(file: File | undefined) {
    if (!file) {
      clear();
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      clear();
      setError("Use a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      clear();
      setError("Image must be 5MB or smaller.");
      return;
    }
    setError("");
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="flex flex-col gap-2">
      <Field label="Image URL">
        <Input name="image_url" defaultValue={defaultValue} />
      </Field>
      <input
        ref={fileRef}
        type="file"
        name="image_file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" icon="photo" onClick={() => fileRef.current?.click()}>
          Upload image
        </Button>
        {fileName && (
          <>
            <span className="hc-caption min-w-0 truncate text-sm">{fileName}</span>
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              Remove
            </Button>
          </>
        )}
      </div>
      {preview && <img src={preview} alt="" className="max-h-40 w-full rounded-md object-cover" />}
      {fileName && <p className="hc-caption text-sm">Saves with the submission and replaces the Image URL.</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
