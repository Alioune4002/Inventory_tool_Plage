import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const close = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast(null);
  }, []);

  const pushToast = useCallback(({ message, type = "info", durationMs = 18000 } = {}) => {
    if (!message) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);

    setToast({ message: String(message), type });

    const ms = Math.max(9000, Number(durationMs) || 18000);
    timerRef.current = window.setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, ms);
  }, []);

  const value = useMemo(() => ({ toast, pushToast, close }), [toast, pushToast, close]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx?.pushToast;
}

export function useToastState() {
  return useContext(ToastContext);
}
