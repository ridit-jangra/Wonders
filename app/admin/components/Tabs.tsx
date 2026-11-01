"use client";

import { useState, type ReactNode } from "react";

export interface TabItem {
  key: string;
  label: ReactNode;
  content: ReactNode;
}

export default function Tabs({
  tabs,
  variant = "underline",
  sticky = false,
  panelClassName = "",
  fill = false,
}: {
  tabs: TabItem[];
  variant?: "underline" | "segmented";
  sticky?: boolean;
  panelClassName?: string;
  fill?: boolean;
}) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");

  return (
    <div className={fill ? "flex h-full min-h-0 flex-col" : undefined}>
      <div
        className={`${fill ? "shrink-0" : ""} ${variant === "segmented" ? "hc-segmented" : "hc-tabs"} ${sticky ? "hc-tabs-sticky" : ""}`}
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === active}
            className={variant === "segmented" ? "hc-segmented-item" : "hc-tab"}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={fill ? "min-h-0 flex-1 overflow-y-auto" : panelClassName}>
        {tabs.map((tab) => (
          <div
            key={tab.key}
            role="tabpanel"
            hidden={tab.key !== active}
            className={fill ? "h-full [&>*:only-child]:min-h-full" : undefined}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
