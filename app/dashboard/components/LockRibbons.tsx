"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function LockRibbons({
  play = false,
  position = "absolute inset-0",
}: {
  play?: boolean;
  position?: string;
}) {
  useEffect(() => {
    if (play) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, [play]);

  return (
    <div aria-hidden className={`pointer-events-none overflow-hidden ${position}`}>
      <motion.img
        src="/locked-rainbow.png"
        alt=""
        initial={play ? { x: "-100%", y: "100%" } : false}
        animate={{ x: 0, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        style={{ scaleX: -1 }}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <motion.img
        src="/locked-rainbow.png"
        alt=""
        initial={play ? { x: "100%", y: "100%" } : false}
        animate={{ x: 0, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.08 }}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
