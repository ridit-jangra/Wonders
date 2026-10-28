/* eslint-disable @next/next/no-img-element */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isAllowedImageSrc } from "@/lib/journal-shared";
import "./journal.css";

export default function JournalMarkdown({ children }: { children: string }) {
  return (
    <div className="wonders-journal-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noreferrer nofollow">
              {linkChildren}
            </a>
          ),
          img: ({ src, alt }) =>
            typeof src === "string" && isAllowedImageSrc(src) ? (
              <img src={src} alt={alt ?? ""} loading="lazy" />
            ) : (
              <span>[image removed]</span>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
