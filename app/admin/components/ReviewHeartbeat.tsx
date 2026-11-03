"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const BEAT_MS = 60_000;
const HIDDEN_RELEASE_MS = 5 * 60_000;

export default function ReviewHeartbeat({
  beat,
  release,
  blocked,
}: {
  beat: () => Promise<{ held: boolean; holder: string }>;
  release: () => Promise<void>;
  blocked: boolean;
}) {
  const router = useRouter();
  const blockedRef = useRef(blocked);
  const beatRef = useRef(beat);
  const releaseRef = useRef(release);
  useEffect(() => {
    blockedRef.current = blocked;
    beatRef.current = beat;
    releaseRef.current = release;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    async function tick() {
      try {
        const result = await beatRef.current();
        if (!active) return;
        if (result.held === blockedRef.current) {
          router.refresh();
        }
      } catch {}
    }

    function start() {
      if (timer) return;
      void tick();
      timer = setInterval(() => void tick(), BEAT_MS);
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenTimer = setTimeout(() => {
          stop();
          void releaseRef.current().then(() => {
            if (active) router.refresh();
          });
        }, HIDDEN_RELEASE_MS);
      } else {
        if (hiddenTimer) {
          clearTimeout(hiddenTimer);
          hiddenTimer = null;
        }
        start();
      }
    }

    if (document.visibilityState === "visible") {
      start();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      stop();
      if (hiddenTimer) clearTimeout(hiddenTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      void releaseRef.current();
    };
  }, [router]);

  return null;
}
