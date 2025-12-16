// src/app/useEntitlements.js
import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthProvider";

/**
 * Retrieve org entitlements/limits/usage.
 * Resilient: returns null data on error instead of throwing.
 *
 * IMPORTANT:
 * Backend route is: /api/auth/me/org/entitlements (see backend/accounts/urls.py)
 */
export function useEntitlements() {
  const { isAuthed } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchEntitlements = useCallback(async () => {
    if (!isAuthed) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      // ✅ IMPORTANT: route correcte (prefix /api/auth)
      const res = await api.get("/api/auth/me/org/entitlements");
      if (!mountedRef.current) return;
      setData(res.data || null);
      setError(null);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e);
      setData(null);
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  return { data, loading, error, refetch: fetchEntitlements };
}

export default useEntitlements;