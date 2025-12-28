import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/cn";

export default function Drawer({ open, onClose, title, children, footer, className = "" }) {
  const panelRef = useRef(null);
  const previousFocus = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement;
    const focusTarget = panelRef.current?.querySelector(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    if (focusTarget) focusTarget.focus();
    return () => {
      previousFocus.current?.focus?.();
    };
  }, [open]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] transition",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl bg-[var(--surface)] shadow-soft border border-[var(--border)]",
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-full sm:w-[520px] sm:rounded-l-3xl sm:rounded-tr-none",
          "transition-transform duration-200",
          open ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : "Panneau"}
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div id={titleId} className="text-base font-semibold text-[var(--text)]">
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--accent)]/15"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-auto max-h-[calc(85vh-130px)] sm:max-h-[calc(100vh-130px)]">
          {children}
        </div>

        {footer && <div className="border-t border-[var(--border)] px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
