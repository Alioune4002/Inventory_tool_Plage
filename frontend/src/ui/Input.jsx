import React from "react";
import { cn } from "../lib/cn";

export default function Input({
  label,
  helper,
  error,
  rightSlot,
  className = "",
  inputRef,
  ...props
}) {
  const hasError = Boolean(error);

  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-[var(--text)]">{label}</span>}

      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border bg-[var(--surface)] px-3 py-2.5 transition",
          "focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/25",
          hasError
            ? "border-[var(--danger-border)] bg-[var(--danger-bg)]"
            : "border-[var(--border)]",
          className
        )}
      >
        <input
          ref={inputRef || undefined}
          {...props}
          className={cn(
            "w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted)] outline-none",
            /* ✅ iOS month/date: parfois le texte est trop clair/transparent */
            (props.type === "month" || props.type === "date") && "appearance-none"
          )}
        />
        {rightSlot}
      </div>

      {(helper || error) && (
        <div className={cn("text-xs", hasError ? "text-[var(--danger-text)]" : "text-[var(--muted)]")}>
          {error || helper}
        </div>
      )}
    </label>
  );
}