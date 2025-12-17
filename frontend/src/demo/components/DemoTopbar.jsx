import React from "react";

export default function DemoTopbar() {
  return (
    <header className="bg-[var(--surface)] border-b border-[var(--border)] p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-black text-[var(--text)]">StockScan</div>
          <div className="text-xs text-[var(--muted)]">Auto-démo</div>
        </div>
        <div className="text-xs font-semibold text-[var(--muted)]">Demo · données fictives</div>
      </div>
    </header>
  );
}
