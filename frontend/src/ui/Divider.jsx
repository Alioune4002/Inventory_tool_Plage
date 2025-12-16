import React from "react";
import { cn } from "../lib/cn";

export default function Divider({ className = "" }) {
  return <div className={cn("h-px w-full bg-slate-200", className)} />;
}
