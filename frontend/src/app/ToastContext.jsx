import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [timerId, setTimerId] = useState(null);

  const close = useCallback(() => {
    if (timerId) window.clearTimeout(timerId);
    setTimerId(null);
    setToast(null);
  }, [timerId]);

  const pushToast = useCallback(
    ({ message, type = "info", durationMs = 3500 } = {}) => {
      if (!message) return;

      if (timerId) window.clearTimeout(timerId);

      setToast({ message: String(message), type });
      const id = window.setTimeout(() => {
        setToast(null);
        setTimerId(null);
      }, Math.max(1200, Number(durationMs) || 3500));
      setTimerId(id);
    },
    [timerId]
  );

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