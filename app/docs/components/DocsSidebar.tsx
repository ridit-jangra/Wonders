/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FullSearchTrigger } from "fumadocs-ui/layouts/shared/slots/search-trigger";
import { DOCS_SIDEBAR_COOKIE } from "./sidebar-cookie";

export interface DocsSidebarPage {
  url: string;
  title: string;
}

function DocsSidebarNav({
  pages,
  onNavigateAction,
}: {
  pages: DocsSidebarPage[];
  onNavigateAction?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      <nav className="wonders-docs-sidebar absolute top-[18%] left-6 flex h-[70%] w-[70%] flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div onClickCapture={onNavigateAction} className="shrink-0">
            <FullSearchTrigger className="w-full border-[#1f2528] bg-[#2a3135] font-poppins text-[#eaf5f3] hover:bg-[#1f2528] hover:text-white [&_kbd]:border-[#454e53] [&_kbd]:bg-[#1f2528] [&_kbd]:text-[#eaf5f3]" />
          </div>
          <div className="wonders-docs-sidebar-scroll -mr-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-3">
            {pages.map((page) => {
              const active = pathname === page.url;
              return (
                <Link
                  key={page.url}
                  href={page.url}
                  onClick={onNavigateAction}
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                  className="relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary data-[active=true]:hover:transition-colors"
                >
                  {page.title}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <Link
        href="/dashboard"
        onClick={onNavigateAction}
        className="absolute bottom-6 left-6 font-finger-paint text-xl text-[#16213E] underline decoration-[#16213E]/40 underline-offset-4 hover:decoration-[#16213E]"
      >
        back to dashboard :)
      </Link>
    </>
  );
}

export default function DocsSidebar({
  pages,
  initialCollapsed,
}: {
  pages: DocsSidebarPage[];
  initialCollapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function changeCollapsed(value: boolean) {
    setCollapsed(value);
    document.cookie = `${DOCS_SIDEBAR_COOKIE}=${value ? "collapsed" : "open"}; path=/docs; max-age=31536000; samesite=lax`;
  }

  function openMenu() {
    if (window.matchMedia("(min-width: 768px)").matches) {
      changeCollapsed(false);
    } else {
      setOpen(true);
    }
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <motion.div
        initial={false}
        animate={{ width: collapsed ? 0 : "auto" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="sticky top-0 hidden h-screen shrink-0 overflow-hidden md:block"
      >
        <div className="relative h-full w-max">
          <img className="h-full w-auto" src="/sidebar.png" alt="" />
          <DocsSidebarNav pages={pages} />
          <button
            type="button"
            onClick={() => changeCollapsed(true)}
            aria-label="collapse sidebar"
            className="absolute top-6 right-0 h-14 w-14 cursor-pointer"
          >
            <img src="/close.png" alt="" className="h-full w-full" />
          </button>
        </div>
      </motion.div>

      <button
        type="button"
        onClick={openMenu}
        aria-label="open menu"
        className={`fixed top-4 left-4 z-40 h-11 w-11 cursor-pointer ${collapsed ? "" : "md:hidden"}`}
      >
        <img src="/hamburger.png" alt="" className="h-full w-full" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-black/40 md:hidden"
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="relative h-full"
            >
              <img className="h-full w-auto" src="/sidebar.png" alt="" />
              <DocsSidebarNav pages={pages} onNavigateAction={() => setOpen(false)} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="close menu"
                className="absolute top-6 right-6 h-14 w-14"
              >
                <img src="/close.png" alt="" className="h-full w-full" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
