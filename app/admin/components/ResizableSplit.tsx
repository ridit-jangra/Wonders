"use client";

import { Children, useEffect, useRef, type ReactNode } from "react";

const KEY = "wonders-review-aside";
const DEFAULT_WIDTH = 460;
const MIN_WIDTH = 340;

function clamp(value: number, container: number) {
  return Math.round(Math.min(Math.max(value, MIN_WIDTH), Math.max(MIN_WIDTH, container * 0.7)));
}

export default function ResizableSplit({ children }: { children: ReactNode }) {
  const [left, right] = Children.toArray(children);
  const root = useRef<HTMLDivElement>(null);

  function apply(width: number) {
    root.current?.style.setProperty("--aside-w", `${width}px`);
  }

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(KEY));
      if (saved && root.current) {
        apply(clamp(saved, root.current.getBoundingClientRect().width));
      }
    } catch {}
  }, []);

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    const element = root.current;
    if (!element) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    let width = DEFAULT_WIDTH;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    function move(e: PointerEvent) {
      const rect = element!.getBoundingClientRect();
      width = clamp(rect.right - e.clientX - 8, rect.width);
      apply(width);
    }
    function stop() {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", stop);
      target.removeEventListener("pointercancel", stop);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      try {
        localStorage.setItem(KEY, String(width));
      } catch {}
    }
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", stop);
    target.addEventListener("pointercancel", stop);
  }

  function reset() {
    apply(DEFAULT_WIDTH);
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }

  return (
    <div
      ref={root}
      className="hc-review grid gap-6 lg:grid-cols-[minmax(0,1fr)_16px_var(--aside-w)] lg:gap-0"
      style={{ ["--aside-w" as string]: `${DEFAULT_WIDTH}px` }}
    >
      {left}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        title="Drag to resize, double-click to reset"
        onPointerDown={startDrag}
        onDoubleClick={reset}
        className="group hidden cursor-col-resize touch-none items-stretch justify-center lg:flex"
      >
        <div className="my-2 w-px rounded-full bg-[var(--border)] transition-colors group-hover:w-0.5 group-hover:bg-[var(--primary)] group-active:w-0.5 group-active:bg-[var(--primary)]" />
      </div>
      {right}
    </div>
  );
}
