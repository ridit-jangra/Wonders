/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef } from "react";

const PAPER_MASK = {
  WebkitMaskImage: "url(/new-or-edit-projects-template.png)",
  maskImage: "url(/new-or-edit-projects-template.png)",
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
} as const;

export default function LockRibbons() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let frame = 0;

    function place() {
      frame = 0;
      const anchor = anchorRef.current;
      const layer = layerRef.current;
      const image = imageRef.current;
      if (!anchor || !layer || !image) {
        return;
      }
      const a = anchor.getBoundingClientRect();
      const l = layer.getBoundingClientRect();
      image.style.left = `${a.left - l.left}px`;
      image.style.top = `${a.top - l.top}px`;
      image.style.width = `${a.width}px`;
      image.style.height = `${a.height}px`;
    }

    function schedule() {
      if (!frame) {
        frame = requestAnimationFrame(place);
      }
    }

    place();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <div
        ref={anchorRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 md:-left-[10vh] md:right-[2vw]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden md:hidden"
      >
        <img
          src="/arrows.png"
          alt=""
          className="absolute inset-0 h-full w-full object-contain object-center"
        />
      </div>
      <div
        ref={layerRef}
        aria-hidden
        className="pointer-events-none fixed top-0 right-[2%] bottom-0 left-[calc(100vh*554/1080-10vh)] z-10 hidden overflow-hidden md:block"
        style={PAPER_MASK}
      >
        <img
          ref={imageRef}
          src="/arrows.png"
          alt=""
          className="absolute max-w-none scale-105 object-contain object-center"
        />
      </div>
    </>
  );
}
