"use client";

import { useSyncExternalStore, type CSSProperties } from "react";

const LAYERS = 7;
const STEP = 100 / (LAYERS + 1);

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

function getScrolled() {
  return window.scrollY > 4;
}

function layerStyle(index: number): CSSProperties {
  const blur = `blur(${0.5 * 2 ** (LAYERS - 1 - index)}px)`;
  const from = Math.max(0, (index - 1) * STEP);
  const stops = [
    index === 0 ? "black 0%" : `transparent ${from}%`,
    `black ${index * STEP}%`,
    `black ${(index + 1) * STEP}%`,
    `transparent ${(index + 2) * STEP}%`,
  ];
  const mask = `linear-gradient(to bottom, ${stops.join(", ")})`;
  return {
    backdropFilter: blur,
    WebkitBackdropFilter: blur,
    maskImage: mask,
    WebkitMaskImage: mask,
  };
}

export default function TopBlur() {
  const scrolled = useSyncExternalStore(subscribe, getScrolled, () => false);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-30 h-24">
      {Array.from({ length: LAYERS }, (_, index) => (
        <div
          key={index}
          style={layerStyle(index)}
          className={`absolute inset-0 transition-opacity duration-200 ${
            scrolled ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </div>
  );
}
