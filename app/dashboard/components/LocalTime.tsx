"use client";

import { useSyncExternalStore } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ordinal(day: number) {
  if (day >= 11 && day <= 13) return `${day}th`;
  const last = day % 10;
  return `${day}${last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th"}`;
}

function format(date: Date, utc: boolean) {
  const year = utc ? date.getUTCFullYear() : date.getFullYear();
  const month = utc ? date.getUTCMonth() : date.getMonth();
  const day = utc ? date.getUTCDate() : date.getDate();
  const hours = utc ? date.getUTCHours() : date.getHours();
  const minutes = String(utc ? date.getUTCMinutes() : date.getMinutes()).padStart(2, "0");
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${ordinal(day)} ${MONTHS[month]} ${year}, ${hour12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
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
    () => format(new Date(iso), true),
  );

  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}
