import React from "react";
import { cn } from "../lib/cn";

export default function Badge({ children, variant = "default", className = "" }) {
  const variants = {
    default: "bg-[var(--badge-default-bg)] text-[var(--badge-default-text)]",
    success: "bg-[var(--badge-success-bg)] text-[var(--badge-success-text)]",
    info: "bg-[var(--badge-info-bg)] text-[var(--badge-info-text)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        variants[variant] || variants.default,
        className
      )}
    >
      {children}
    </span>
  );
}