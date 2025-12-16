import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../lib/cn";

export default function Toast({ toast, onClose }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 shadow-soft border",
              toast.type === "error"
                ? "bg-red-600 text-white border-red-500"
                : toast.type === "success"
                  ? "bg-emerald-600 text-white border-emerald-500"
                  : "bg-slate-900 text-white border-slate-800"
            )}
          >
            <div className="text-sm">{toast.message}</div>
            <button
              onClick={onClose}
              className="rounded-xl px-2 py-1 text-sm bg-white/10 hover:bg-white/15"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
