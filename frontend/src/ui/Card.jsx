import React from "react";
import { cn } from "../lib/cn";

const Card = React.forwardRef(function Card({ children, className = "", glass = false, hover = false }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-[24px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-soft transition duration-200",
        glass && "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--glass-text)] backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.20)]",
        hover && "hover:-translate-y-[2px]",
        className
      )}
    >
      {children}
    </div>
  );
});

export default Card;
