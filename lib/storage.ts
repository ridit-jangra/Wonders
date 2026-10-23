import "server-only";
import { sql } from "@/lib/db";

export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

const THUMBNAIL_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const THUMBNAIL_MIME_TYPES = Object.keys(THUMBNAIL_EXTENSIONS);

export async function uploadThumbnail(
  file: File,
  profileId: string,
): Promise<string> {
  if (!THUMBNAIL_EXTENSIONS[file.type]) {
    throw new Error(`Unsupported thumbnail type: ${file.type || "unknown"}`);
  }
  if (file.size > MAX_THUMBNAIL_BYTES) {
    throw new Error(
      `Thumbnail is larger than ${MAX_THUMBNAIL_BYTES / (1024 * 1024)}MB`,
    );
  }

  const data = Buffer.from(await file.arrayBuffer());
  const [{ id }] = await sql<{ id: string }[]>`
    insert into thumbnails (profile_id, content_type, data)
    values (${profileId}, ${file.type}, ${data})
    returning id
  `;
  return `/api/thumbnails/${id}`;
}

export async function getThumbnail(
  id: string,
): Promise<{ content_type: string; data: Buffer } | null> {
  const [thumbnail] = await sql<{ content_type: string; data: Buffer }[]>`
    select content_type, data from thumbnails where id = ${id}
  `;
  return thumbnail ?? null;
}
