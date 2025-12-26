import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../lib/cn";
import { useToastState } from "../app/ToastContext";

const toneClass = (type) => {
  if (type === "error")
    return "bg-[var(--danger-bg)] text-[var(--danger-text)] border-[var(--danger-border)]";
  if (type === "success")
    return "bg-[var(--success-bg)] text-[var(--success-text)] border-[var(--success-border)]";
  if (type === "warn" || type === "warning")
    return "bg-[var(--warn-bg)] text-[var(--warn-text)] border-[var(--warn-border)]";
  return "bg-[var(--info-bg)] text-[var(--info-text)] border-[var(--info-border)]";
};

export default function Toasts() {
  const { toast, close } = useToastState() || {};

  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 shadow-soft border max-w-[92vw]",
              toneClass(toast.type)
            )}
            role="status"
            aria-live="polite"
          >
            <div className="text-sm">{toast.message}</div>
            <button
              type="button"
              onClick={close}
              className="rounded-xl px-2 py-1 text-sm bg-black/10 hover:bg-black/15"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}


