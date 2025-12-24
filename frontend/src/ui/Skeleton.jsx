import React from "react";
import { cn } from "../lib/cn";

export default function Skeleton({ className }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-white/5 border border-white/10",
        "before:absolute before:inset-0",
        "before:-translate-x-full before:animate-skeleton-shimmer",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        className
      )}
    />
  );
}