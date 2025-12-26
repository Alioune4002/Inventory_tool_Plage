
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { api, setAuthToken } from "../lib/api";
import {
  apiLogin,
  apiMe,
  apiRegister,
  clearToken,
  getStoredServiceId,
  getStoredToken,
  storeServiceId,
  storeToken,
} from "../lib/auth";
import { getTourKey, getTourPendingKey } from "../lib/tour";

const AuthContext = createContext(null);

function normalizeId(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function canUseAll(services) {
  return Array.isArray(services) && services.length > 1;
}

function pickInitialServiceId(services, stored) {
  const list = Array.isArray(services) ? services : [];
  const storedId = normalizeId(stored);

  if (!list.length) return "";

  if (storedId === "all") {
    return canUseAll(list) ? "all" : normalizeId(list[0].id);
  }

  const isValid = storedId && list.some((s) => normalizeId(s.id) === storedId);
  if (isValid) return storedId;

  return normalizeId(list[0].id);
}

function looksLikeHtml(value) {
  return typeof value === "string" && /<\s*(!doctype|html|head|body)\b/i.test(value);
}

function isNetworkError(err) {
  return Boolean(err) && !err.response;
}

function friendlyAuthError(err, fallback) {
  if (err?.friendlyMessage) return String(err.friendlyMessage);

  if (isNetworkError(err)) {
    return "Impossible de joindre le serveur. Vérifie ta connexion internet et réessaie.";
  }

  const status = err?.response?.status;
  const data = err?.response?.data;

  if (looksLikeHtml(data)) {
    return "Service indisponible pour le moment. Réessaie dans quelques instants.";
  }

  const code = data?.code;
  if (code === "email_not_verified") {
    return "Email non vérifié. Vérifie ta boîte mail pour activer ton compte.";
  }

  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;

  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    return String(data.non_field_errors[0]);
  }

  if (data && typeof data === "object") {
    const parts = [];
    Object.keys(data).forEach((k) => {
      if (k === "detail" || k === "code" || k === "non_field_errors") return;
      const v = data[k];
      if (Array.isArray(v) && v.length) parts.push(v.join(" · "));
      else if (typeof v === "string" && v) parts.push(v);
    });
    if (parts.length) return parts.join(" · ");
  }

  if (status === 401) return "Identifiants incorrects.";
  if (status === 403) return "Accès refusé.";
  if (status >= 500) return "Service indisponible pour le moment. Réessaie dans quelques instants.";

  return fallback || "Une erreur est survenue. Réessaie.";
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken());
  const [me, setMe] = useState(null);
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState(getStoredServiceId());
  const [serviceProfile, setServiceProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Theme bootstrap (important sur mobile + refresh)
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem("theme");
      if (storedTheme === "light" || storedTheme === "dark") {
        document.documentElement.setAttribute("data-theme", storedTheme);
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const refreshMe = useCallback(async () => {
    const existing = getStoredToken();
    if (!existing) {
      setMe(null);
      return null;
    }
    setAuthToken(existing);
    const meData = await apiMe();
    setMe(meData);
    return meData;
  }, []);

  const fetchServices = useCallback(async () => {
    const res = await api.get("/api/auth/services/");
    const list = Array.isArray(res.data) ? res.data : [];
    setServices(list);

    const stored = getStoredServiceId();
    const chosen = pickInitialServiceId(list, stored);

    setServiceId(chosen);
    storeServiceId(chosen);

    if (chosen && chosen !== "all") {
      const found = list.find((s) => normalizeId(s.id) === normalizeId(chosen)) || null;
      setServiceProfile(found);
    } else {
      setServiceProfile(null);
    }

    return list;
  }, []);

  const bootstrap = useCallback(async () => {
    const existing = getStoredToken();
    if (!existing) {
      setLoading(false);
      setMe(null);
      setServices([]);
      setServiceId("");
      storeServiceId("");
      setServiceProfile(null);
      return;
    }

    try {
      setLoading(true);
      setAuthToken(existing);

      const meData = await apiMe();
      setMe(meData);

      await fetchServices();
    } catch (e) {
      clearToken();
      setToken("");
      setMe(null);
      setServices([]);
      setServiceId("");
      storeServiceId("");
      setServiceProfile(null);
    } finally {
      setLoading(false);
    }
  }, [fetchServices]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async ({ username, password }) => {
      try {
        const data = await apiLogin({ username, password });
        if (!data?.access) throw new Error("Réponse serveur invalide.");

        storeToken(data.access);
        setToken(data.access);

        const userId = data?.user?.id || data?.user_id || data?.id;
        if (userId) {
          const tourKey = getTourKey(userId);
          if (localStorage.getItem(tourKey) !== "done") {
            localStorage.setItem(getTourPendingKey(userId), "1");
          }
        }

        await refreshMe();
        await fetchServices();

        return data;
      } catch (e) {
        const err = new Error(
          friendlyAuthError(e, "Connexion impossible. Vérifie tes identifiants et réessaie.")
        );
        err.code = e?.response?.data?.code || null;
        err.isEmailNotVerified = err.code === "email_not_verified";
        throw err;
      }
    },
    [fetchServices, refreshMe]
  );

  const logout = useCallback(() => {
    clearToken();
    setToken("");
    setMe(null);
    setServices([]);
    setServiceId("");
    storeServiceId("");
    setServiceProfile(null);
  }, []);

  const register = useCallback(
    async ({
      email,
      password,
      tenant_name,
      domain,
      service_type,
      service_name,
      business_type,
      extra_services,
    }) => {
      try {
        const data = await apiRegister({
          email,
          password,
          tenant_name,
          domain,
          service_type,
          service_name,
          business_type,
          extra_services,
        });

        if (data?.requires_verification) {
          return data;
        }

        if (!data?.access) throw new Error("Réponse serveur invalide.");

        storeToken(data.access);
        setToken(data.access);

        const userId = data?.user?.id || data?.user_id || data?.id;
        if (userId) {
          const tourKey = getTourKey(userId);
          if (localStorage.getItem(tourKey) !== "done") {
            localStorage.setItem(getTourPendingKey(userId), "1");
          }
        }

        await refreshMe();
        await fetchServices();

        return data;
      } catch (e) {
        const err = new Error(
          friendlyAuthError(
            e,
            "Création impossible. Vérifie l’email, le mot de passe et le nom du commerce."
          )
        );
        err.code = e?.response?.data?.code;
        throw err;
      }
    },
    [fetchServices, refreshMe]
  );

  const selectService = useCallback(
    (id) => {
      const next = normalizeId(id);

      if (next === "all" && !canUseAll(services)) {
        const fallback = services?.[0] ? normalizeId(services[0].id) : "";
        setServiceId(fallback);
        storeServiceId(fallback);
        setServiceProfile(services.find((s) => normalizeId(s.id) === fallback) || null);
        return;
      }

      setServiceId(next);
      storeServiceId(next);

      if (next === "all") {
        setServiceProfile(null);
        return;
      }

      const found = services.find((s) => normalizeId(s.id) === next) || null;
      setServiceProfile(found);
    },
    [services]
  );

  useEffect(() => {
    if (!services?.length) return;

    if (serviceId === "all") {
      if (serviceProfile !== null) setServiceProfile(null);
      return;
    }

    const found = services.find((s) => normalizeId(s.id) === normalizeId(serviceId)) || null;
    if (found !== serviceProfile) {
      setServiceProfile(found);
    }
  }, [services, serviceId, serviceProfile]);

  const isAllServices = useMemo(() => {
    return canUseAll(services) && normalizeId(serviceId) === "all";
  }, [services, serviceId]);

  const currentService = useMemo(() => {
    if (!services?.length) return null;
    if (normalizeId(serviceId) === "all") return null;
    return services.find((s) => normalizeId(s.id) === normalizeId(serviceId)) || null;
  }, [services, serviceId]);

  const tenant = me?.tenant || null;
  const activeServiceProfile = serviceProfile || currentService || null;

  const serviceFeatures = activeServiceProfile?.features || {};
  const countingMode = activeServiceProfile?.counting_mode || "unit";

  const value = useMemo(
    () => ({
      token,
      me,
      tenant,
      isAuthed: Boolean(token && me),
      loading,

      services,
      serviceId,
      isAllServices,

      currentService,
      serviceProfile: activeServiceProfile,

      serviceFeatures,
      countingMode,

      selectService,
      refreshServices: fetchServices,
      refreshMe,
      bootstrap,

      login,
      register,
      logout,

      setMe,
    }),
    [
      token,
      me,
      tenant,
      loading,
      services,
      serviceId,
      isAllServices,
      currentService,
      activeServiceProfile,
      serviceFeatures,
      countingMode,
      selectService,
      fetchServices,
      refreshMe,
      bootstrap,
      login,
      register,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
