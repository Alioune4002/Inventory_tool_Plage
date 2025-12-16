// src/app/useEntitlements.js
import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthProvider";

/**
 * Small helper hook to retrieve org entitlements/limits/usage.
 * It is resilient: on error it returns null data instead of throwing.
 */
export function useEntitlements() {
  const { isAuthed } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEntitlements = useCallback(async () => {
    if (!isAuthed) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get("/api/me/org/entitlements");
      setData(res.data || null);
      setError(null);
    } catch (e) {
      setError(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  return { data, loading, error, refetch: fetchEntitlements };
}

export default useEntitlements;
