/* eslint-disable @next/next/no-img-element */
"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function DrawerFrame({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ x: "-100%" }}
      animate={{ x: 0 }}
      exit={{ x: "-100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      onClick={(e) => e.stopPropagation()}
      className="relative h-full w-full overflow-hidden bg-[#56a7a6]"
    >
      <div className="relative h-full" style={{ width: "min(100%, 62svh)" }}>
        <img className="h-full w-full max-w-none" src="/sidebar.png" alt="" />
        {children}
      </div>
    </motion.div>
  );
}
