// src/app/AuthProvider.jsx
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

  // Autoriser "all" uniquement s'il y a plusieurs services
  if (storedId === "all") {
    return canUseAll(list) ? "all" : normalizeId(list[0].id);
  }

  // Si stored valide, on le garde
  const isValid = storedId && list.some((s) => normalizeId(s.id) === storedId);
  if (isValid) return storedId;

  // Sinon on prend le premier
  return normalizeId(list[0].id);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken());
  const [me, setMe] = useState(null); // user + tenant
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState(getStoredServiceId());
  const [serviceProfile, setServiceProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // bootstrap token in axios
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
      // "all" => pas de serviceProfile unique
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
      // token invalide
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
        if (!data?.access) throw new Error("Token manquant dans la réponse login");

        storeToken(data.access);
        setToken(data.access);

        await refreshMe();
        await fetchServices();

        return data;
      } catch (e) {
        if (!e?.response) {
          throw new Error(
            "API inaccessible (vérifie que le backend tourne et que l’URL API est correcte)."
          );
        }
        const detail =
          e.response?.data?.detail ||
          e.response?.data?.non_field_errors?.[0] ||
          "Connexion impossible. Vérifiez vos identifiants.";
        throw new Error(detail);
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

        if (!data?.access) throw new Error("Token manquant dans la réponse register");

        storeToken(data.access);
        setToken(data.access);

        await refreshMe();
        await fetchServices();

        return data;
      } catch (e) {
        if (!e?.response) {
          throw new Error(
            "API inaccessible (vérifie que le backend tourne et que l’URL API est correcte)."
          );
        }
        const apiMsg =
          e.response?.data?.detail ||
          e.response?.data?.non_field_errors?.[0] ||
          e.response?.data?.email?.[0] ||
          e.response?.data?.password?.[0] ||
          "Création impossible. Vérifiez email, mot de passe et nom du commerce.";
        throw new Error(apiMsg);
      }
    },
    [fetchServices, refreshMe]
  );

  const selectService = useCallback(
    (id) => {
      const next = normalizeId(id);

      // sécurise "all"
      if (next === "all" && !canUseAll(services)) {
        const fallback = services?.[0] ? normalizeId(services[0].id) : "";
        setServiceId(fallback);
        storeServiceId(fallback);
        setServiceProfile(
          services.find((s) => normalizeId(s.id) === fallback) || null
        );
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

  // keep serviceProfile in sync when services list or serviceId change
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

  // exposer un profil "actif" utile côté UI (si pas de serviceProfile, fallback currentService)
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
      bootstrap, // utile si tu veux forcer un re-bootstrap après une action critique

      login,
      register,
      logout,

      setMe, // utile si tu updates profile plus tard
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