import "server-only";
import crypto from "node:crypto";
import { supabase } from "@/lib/supabase";

export const THUMBNAIL_BUCKET = "wonder-thumbnails";
export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

const THUMBNAIL_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const THUMBNAIL_MIME_TYPES = Object.keys(THUMBNAIL_EXTENSIONS);

/**
 * Uploads a thumbnail to the public bucket and returns its public URL.
 * Files are namespaced per profile so one person can never overwrite another's.
 */
export async function uploadThumbnail(
  file: File,
  profileId: string,
): Promise<string> {
  const extension = THUMBNAIL_EXTENSIONS[file.type];
  if (!extension) {
    throw new Error(`Unsupported thumbnail type: ${file.type || "unknown"}`);
  }
  if (file.size > MAX_THUMBNAIL_BYTES) {
    throw new Error(
      `Thumbnail is larger than ${MAX_THUMBNAIL_BYTES / (1024 * 1024)}MB`,
    );
  }

  const path = `${profileId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
