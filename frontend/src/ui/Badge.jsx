import React from "react";
import { cn } from "../lib/cn";

export default function Badge({ children, variant = "neutral", className = "" }) {
  const variants = {
    neutral: "bg-[var(--accent)]/20 text-[var(--text)] border border-[var(--border)]",
    default: "bg-[var(--accent)]/20 text-[var(--text)] border border-[var(--border)]",
    info: "bg-blue-500/15 text-blue-700 border border-blue-500/25",
    success: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/25",
    warn: "bg-amber-500/15 text-amber-700 border border-amber-500/25",
    danger: "bg-rose-500/15 text-rose-700 border border-rose-500/25",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        variants[variant] || variants.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}