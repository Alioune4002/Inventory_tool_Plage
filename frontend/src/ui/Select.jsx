import React, { useEffect, useId, useMemo, useRef, useState } from "react";
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const labelId = useId();
  const listboxId = useId();
  const buttonId = useId();

  const normalizedValue = value === undefined || value === null ? "" : String(value);
  const selected = useMemo(
    () => options.find((opt) => String(opt.value) === normalizedValue),
    [options, normalizedValue]
  );
  const selectedIndex = useMemo(
    () => options.findIndex((opt) => String(opt.value) === normalizedValue),
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

  useEffect(() => {
    if (!open) return;
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
    setActiveIndex(nextIndex);
    listRef.current?.focus();
  }, [open, selectedIndex]);

  const handleSelect = (optionValue) => {
    if (disabled) return;
    setOpen(false);
    onChange?.(optionValue);
  };

  const moveActive = (direction) => {
    if (!options.length) return;
    setActiveIndex((prev) => {
      const next = prev < 0 ? 0 : prev + direction;
      if (next < 0) return options.length - 1;
      if (next >= options.length) return 0;
      return next;
    });
  };

  const handleButtonKeyDown = (event) => {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      moveActive(-1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((prev) => !prev);
    }
  };

  const handleListKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (activeIndex >= 0 && options[activeIndex]) {
        handleSelect(options[activeIndex].value);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <label className={cn("block space-y-1.5", className)}>
      {label && (
        <span id={labelId} className="text-sm font-medium text-[var(--text)]">
          {label}
        </span>
      )}
      <div ref={wrapRef} className="relative min-w-0">
        <button
          type="button"
          id={buttonId}
          aria-label={label ? undefined : ariaLabel || placeholder}
          aria-labelledby={label ? labelId : undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-disabled={disabled}
          onClick={() => !disabled && setOpen((prev) => !prev)}
          onKeyDown={handleButtonKeyDown}
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
            <ul
              id={listboxId}
              className="max-h-64 overflow-auto py-1 text-sm"
              role="listbox"
              aria-labelledby={label ? labelId : buttonId}
              aria-activedescendant={
                activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
              }
              onKeyDown={handleListKeyDown}
              ref={listRef}
              tabIndex={-1}
            >
              {options.map((opt, index) => {
                const optValue = String(opt.value);
                const isSelected = optValue === normalizedValue;
                const isActive = index === activeIndex;
                return (
                  <li key={optValue}>
                    <button
                      type="button"
                      id={`${listboxId}-opt-${index}`}
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-xl transition",
                        isActive ? "bg-[var(--primary)]/20" : "hover:bg-[var(--accent)]/20",
                        isSelected
                          ? "bg-[var(--primary)]/15 text-[var(--text)]"
                          : "text-[var(--text)]"
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
