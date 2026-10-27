"use client";

import { useSyncExternalStore } from "react";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function format(date: Date, utc: boolean) {
  const year = utc ? date.getUTCFullYear() : date.getFullYear();
  const month = utc ? date.getUTCMonth() : date.getMonth();
  const day = utc ? date.getUTCDate() : date.getDate();
  const hours = utc ? date.getUTCHours() : date.getHours();
  const minutes = utc ? date.getUTCMinutes() : date.getMinutes();
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${year}-${pad(month + 1)}-${pad(day)} ${pad(hour12)}:${pad(minutes)} ${suffix}`;
}

export default function LocalTime({
  iso,
  className = "",
}: {
  iso: string;
  className?: string;
}) {
  const text = useSyncExternalStore(
    () => () => {},
    () => format(new Date(iso), false),
    () => `${format(new Date(iso), true)} UTC`,
  );

  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}
