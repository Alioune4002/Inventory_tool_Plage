import React, { createContext, useContext } from "react";

// simple toast context : pushToast({message, type})
export const ToastContext = createContext(() => {});

export function ToastProvider({ pushToast, children }) {
  return <ToastContext.Provider value={pushToast}>{children}</ToastContext.Provider>;
}

export function useToast() {
  return useContext(ToastContext);
}
