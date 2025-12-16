import React from "react";
import { cn } from "../lib/cn";

export default function Card({ children, className = "", glass = false, hover = false }) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-soft transition duration-200",
        glass && "border-white/15 bg-white/10 backdrop-blur-xl text-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]",
        hover && "hover:-translate-y-[2px]",
        className
      )}
    >
      {children}
    </div>
  );
}
