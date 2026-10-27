"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

const EASE = [0.215, 0.61, 0.355, 1] as const;
const DURATION = 0.55;

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
        transition={{ duration: DURATION, ease: EASE }}
        style={{ scaleX: -1 }}
        className="absolute -inset-[15%] h-[130%] w-[130%] max-w-none object-cover"
      />
      <motion.img
        src="/locked-rainbow.png"
        alt=""
        initial={play ? { x: "100%", y: "100%" } : false}
        animate={{ x: 0, y: 0 }}
        transition={{ duration: DURATION, ease: EASE, delay: 0.1 }}
        className="absolute -inset-[15%] h-[130%] w-[130%] max-w-none object-cover"
      />
    </div>
  );
}
