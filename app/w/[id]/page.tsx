/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedWonder } from "@/lib/share";
import { absoluteImageUrl } from "@/lib/airtable-fields";
import { creativeWorkJsonLd, jsonLdScript } from "@/lib/seo";
import { YSWS } from "@/lib/ysws-config";

type Params = Promise<{ id: string }>;

function summary(text: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 180 ? `${flat.slice(0, 177)}...` : flat;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const wonder = await getSharedWonder(id);
  if (!wonder) {
    return { title: "Wonders" };
  }
  const title = `${wonder.title} · Wonders`;
  const description = summary(wonder.description);
  const image = absoluteImageUrl(wonder.image_url) || "/opengraph-image.png";
  return {
    title,
    description,
    alternates: { canonical: `/w/${wonder.id}` },
    openGraph: { title, description, type: "article", url: `/w/${wonder.id}`, images: [{ url: image }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharedWonderPage({ params }: { params: Params }) {
  const { id } = await params;
  const wonder = await getSharedWonder(id);
  if (!wonder) notFound();

  const image = absoluteImageUrl(wonder.image_url) || `${YSWS.origin}/opengraph-image.png`;
  const structured = creativeWorkJsonLd({
    id: wonder.id,
    title: wonder.title,
    description: wonder.description,
    image,
    makers: wonder.makers.map((maker) => maker.name),
    repo: wonder.github_url,
    demo: wonder.link_url,
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structured) }} />
      <img className="fixed inset-0 -z-10 h-full w-full object-cover" src="/bg-effect-4.png" alt="" />
      <article className="w-full max-w-2xl rounded-2xl bg-[#F0EBD1] p-5 shadow-xl sm:p-8">
        <img
          src={wonder.image_url || "/project-image-fallback.png"}
          alt=""
          className="aspect-video w-full rounded-lg object-cover"
        />
        <h1 className="mt-5 font-finger-paint text-3xl text-[#5C4A2E] sm:text-4xl">{wonder.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {wonder.makers.map((maker, index) => (
            <span key={index} className="flex items-center gap-2 font-finger-paint text-[#5C4A2E]/80">
              {maker.avatarUrl && <img src={maker.avatarUrl} alt="" className="h-6 w-6 rounded-full" />}
              {maker.name}
            </span>
          ))}
        </div>
        <p className="mt-4 whitespace-pre-wrap font-finger-paint text-[#5C4A2E]">{wonder.description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {wonder.link_url && (
            <a
              href={wonder.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#A8C7E0] px-4 py-2 font-finger-paint text-lg text-black/50 transition-all hover:zoom-110"
            >
              try it :D
            </a>
          )}
          {wonder.github_url && (
            <a
              href={wonder.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#D1E4B5] px-4 py-2 font-finger-paint text-lg text-black/50 transition-all hover:zoom-110"
            >
              the code :3
            </a>
          )}
          <Link
            href="/"
            className="rounded-lg bg-[#F2B3AD] px-4 py-2 font-finger-paint text-lg text-black/50 transition-all hover:zoom-110"
          >
            make your own wonder
          </Link>
        </div>
      </article>
    </div>
  );
}
