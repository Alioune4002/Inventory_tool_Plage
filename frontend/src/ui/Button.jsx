import React from "react";
import { cn } from "../lib/cn";

const variants = {
  primary: "bg-blue-600 text-white shadow-glow hover:-translate-y-[1px]",
  secondary: "bg-white/10 text-white border border-white/25 hover:bg-white/15",
  ghost: "bg-transparent text-white border border-white/25 hover:bg-white/10",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-glow",
};

const sizes = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base",
};

export default function Button({
  children,
  as: Comp = "button",
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  disabled = false,
  onClick,
  type,
  ...props
}) {
  const isButton = Comp === "button";
  const isDisabled = loading || disabled;

  const handleClick = (e) => {
    if (isDisabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick?.(e);
  };

  return (
    <Comp
      {...props}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200",
        "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70",
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        isDisabled && "opacity-60 cursor-not-allowed pointer-events-none",
        className
      )}
      // type seulement si c’est un vrai <button>
      type={isButton ? type || "button" : undefined}
      // disabled seulement si c’est un vrai <button>
      disabled={isButton ? isDisabled : undefined}
      // accessibilité si c’est un lien/composant
      aria-disabled={!isButton ? isDisabled : undefined}
      role={!isButton && isDisabled ? "link" : undefined}
      tabIndex={!isButton && isDisabled ? -1 : props.tabIndex}
    >
      {loading && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
      )}
      {children}
    </Comp>
  );
}