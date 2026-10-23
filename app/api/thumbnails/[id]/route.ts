import { getThumbnail } from "@/lib/storage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const thumbnail = await getThumbnail(id);
  if (!thumbnail) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(thumbnail.data), {
    headers: {
      "Content-Type": thumbnail.content_type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
