"use client";

import { useSyncExternalStore } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function format(date: Date, utc: boolean) {
  const year = utc ? date.getUTCFullYear() : date.getFullYear();
  const month = utc ? date.getUTCMonth() : date.getMonth();
  const day = utc ? date.getUTCDate() : date.getDate();
  const hours = utc ? date.getUTCHours() : date.getHours();
  const minutes = String(utc ? date.getUTCMinutes() : date.getMinutes()).padStart(2, "0");
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const thisYear = new Date().getFullYear();
  return `${day} ${MONTHS[month]}${year === thisYear ? "" : ` ${year}`}, ${hour12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
}

export default function AdminTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    () => () => {},
    () => format(new Date(iso), false),
    () => format(new Date(iso), true),
  );
  return <time dateTime={new Date(iso).toISOString()}>{text}</time>;
}
