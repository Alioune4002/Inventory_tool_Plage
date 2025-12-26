import React from "react";
import { cn } from "../lib/cn";

export default function Skeleton({ className }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border",
        "bg-[var(--accent)]/25 border-[var(--border)]",
        "before:absolute before:inset-0",
        "before:-translate-x-full before:animate-skeleton-shimmer",
        "before:bg-gradient-to-r before:from-transparent before:via-[var(--surface)]/60 before:to-transparent",
        className
      )}
    />
  );
}