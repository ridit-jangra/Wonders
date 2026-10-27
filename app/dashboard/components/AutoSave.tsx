"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "@hackclub/icons";

type Status = "idle" | "saving" | "saved" | "error" | "needs-title";
type Toast = "saved" | "error";

const TOAST_MS = 1850;

const MESSAGE: Record<Status, string> = {
  idle: "changes save on their own :3",
  saving: "saving... :3",
  saved: "saved :3",
  error: "couldn't save that, hit Save it :(",
  "needs-title": "give it a name and it'll save :3",
};

function describeFile(file: File) {
  if (file.size === 0 && !file.name) return "";
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function fileSignature(data: FormData) {
  const file = data.get("thumbnail");
  return file instanceof File ? describeFile(file) : "";
}

function signature(data: FormData) {
  return JSON.stringify(
    [...data.entries()].map(([name, value]) => [
      name,
      value instanceof File ? `file:${describeFile(value)}` : value,
    ]),
  );
}

const MAX_SAVES = 6;
const WINDOW_MS = 5000;

export default function AutoSave({
  action,
  delay = 800,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean }>;
  delay?: number;
}) {
  const holder = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [toast, setToast] = useState<Toast | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function showToast(kind: Toast) {
    setToast(kind);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const form = holder.current?.closest("form");
    if (!form) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let saving = false;
    let again = false;
    let stopped = false;
    const recent: number[] = [];
    let lastSaved = signature(new FormData(form));
    let lastFile = fileSignature(new FormData(form));

    async function run() {
      timer = undefined;
      if (!form || stopped) return;
      if (saving) {
        again = true;
        return;
      }

      const data = new FormData(form);
      const current = signature(data);
      if (current === lastSaved) return;

      if (!String(data.get("title") ?? "").trim()) {
        setStatus("needs-title");
        return;
      }

      const now = Date.now();
      recent.push(now);
      while (recent.length && now - recent[0] > WINDOW_MS) recent.shift();
      if (recent.length > MAX_SAVES) {
        stopped = true;
        setStatus("error");
        showToast("error");
        return;
      }

      const file = fileSignature(data);
      if (file === lastFile) data.delete("thumbnail");

      saving = true;
      setStatus("saving");
      try {
        const result = await action(data);
        if (result.ok) {
          lastSaved = current;
          lastFile = file;
          setStatus("saved");
          showToast("saved");
          router.refresh();
        } else {
          setStatus("error");
          showToast("error");
        }
      } catch {
        setStatus("error");
        showToast("error");
      } finally {
        saving = false;
        if (again) {
          again = false;
          schedule();
        }
      }
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delay);
    }

    function flush() {
      if (document.visibilityState !== "hidden") return;
      if (timer) clearTimeout(timer);
      void run();
    }

    const observer = new MutationObserver((mutations) => {
      const own = mutations.every(
        (m) => m.target.parentElement?.closest("[data-autosave-status]") || (m.target as Element).closest?.("[data-autosave-status]"),
      );
      if (!own) schedule();
    });

    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", flush);
    observer.observe(form, { childList: true, subtree: true });

    return () => {
      if (timer) {
        clearTimeout(timer);
        void run();
      }
      form.removeEventListener("input", schedule);
      form.removeEventListener("change", schedule);
      document.removeEventListener("visibilitychange", flush);
      observer.disconnect();
    };
  }, [action, delay, router]);

  return (
    <>
      <span
        ref={holder}
        data-autosave-status
        aria-live="polite"
        className={`font-finger-paint text-sm ${
          status === "error" ? "text-[#A33B32]" : "text-[#5C4A2E]/60"
        }`}
      >
        {MESSAGE[status]}
      </span>
      {mounted && createPortalToast(toast)}
    </>
  );
}

function createPortalToast(toast: Toast | null) {
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
      <AnimatePresence>
        {toast && (
          <motion.div
            key="autosave-toast"
            role="status"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className={`flex w-[min(28rem,calc(100vw-9rem))] items-center justify-center gap-2 rounded-[12px] border border-[#8C8368]/30 bg-[#F0EBD1] px-5 py-3 font-finger-paint text-lg ${
              toast === "error" ? "text-[#A33B32]" : "text-[#5C4A2E]"
            }`}
          >
            {toast === "saved" && <Icon glyph="checkmark" size={22} aria-hidden />}
            {toast === "saved" ? "saved :3" : "couldn't save that :("}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
