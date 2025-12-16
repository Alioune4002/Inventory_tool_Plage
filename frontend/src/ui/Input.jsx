import React from "react";
import { cn } from "../lib/cn";

export default function Input({
  label,
  helper,
  error,
  rightSlot,
  className = "",
  ...props
}) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-[var(--text)]">{label}</span>}
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border bg-[var(--surface)] px-3 py-2.5 transition",
          "focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200/40",
          error ? "border-red-400 bg-red-50" : "border-[var(--border)]",
          className
        )}
      >
        <input
          {...props}
          className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted)] outline-none"
        />
        {rightSlot}
      </div>
      {(helper || error) && (
        <div className={cn("text-xs", error ? "text-red-500" : "text-[var(--muted)]")}>
          {error || helper}
        </div>
      )}
    </label>
  );
}
