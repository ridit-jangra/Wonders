import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isAllowedImageSrc } from "@/lib/journal-shared";

export default function Markdown({
  children,
  restrictImages = false,
}: {
  children: string;
  restrictImages?: boolean;
}) {
  return (
    <div className="hc-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noreferrer nofollow">
              {linkChildren}
            </a>
          ),
          ...(restrictImages
            ? {
                img: ({ src, alt }) =>
                  typeof src === "string" && isAllowedImageSrc(src) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={alt ?? ""} loading="lazy" />
                  ) : (
                    <span>[image removed]</span>
                  ),
              }
            : {}),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
