import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

export default function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Sélectionner",
  helper,
  disabled = false,
  className = "",
  buttonClassName = "",
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const normalizedValue = value === undefined || value === null ? "" : String(value);
  const selected = useMemo(
    () => options.find((opt) => String(opt.value) === normalizedValue),
    [options, normalizedValue]
  );

  useEffect(() => {
    const handleClick = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const handleSelect = (optionValue) => {
    if (disabled) return;
    setOpen(false);
    onChange?.(optionValue);
  };

  return (
    <label className={cn("block space-y-1.5", className)}>
      {label && <span className="text-sm font-medium text-[var(--text)]">{label}</span>}
      <div ref={wrapRef} className="relative min-w-0">
        <button
          type="button"
          aria-label={ariaLabel || label || placeholder}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => !disabled && setOpen((prev) => !prev)}
          className={cn(
            "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)]",
            "inline-flex items-center justify-between gap-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40",
            disabled && "opacity-60 cursor-not-allowed",
            buttonClassName
          )}
        >
          <span className={cn("truncate", !selected && "text-[var(--muted)]")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
        </button>

        {open && !disabled && (
          <div className="absolute z-50 mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-soft">
            <ul className="max-h-64 overflow-auto py-1 text-sm" role="listbox">
              {options.map((opt) => {
                const optValue = String(opt.value);
                const isSelected = optValue === normalizedValue;
                return (
                  <li key={optValue}>
                    <button
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-xl transition",
                        isSelected
                          ? "bg-[var(--primary)]/15 text-[var(--text)]"
                          : "hover:bg-[var(--accent)]/20 text-[var(--text)]"
                      )}
                      role="option"
                      aria-selected={isSelected}
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      {helper ? <div className="text-xs text-[var(--muted)]">{helper}</div> : null}
    </label>
  );
}
