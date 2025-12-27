
import { api, setAuthToken } from "./api";

const ACCESS_KEY = "accessToken";
const SERVICE_KEY = "serviceId";

export function getStoredToken() {
  return localStorage.getItem(ACCESS_KEY) || "";
}

export function storeToken(token) {
  localStorage.setItem(ACCESS_KEY, token);
  setAuthToken(token);
}

export function clearToken() {
  localStorage.removeItem(ACCESS_KEY);
  setAuthToken("");
}

export function getStoredServiceId() {
  return localStorage.getItem(SERVICE_KEY) || "";
}

export function storeServiceId(id) {
  if (!id) return localStorage.removeItem(SERVICE_KEY);
  localStorage.setItem(SERVICE_KEY, String(id));
}

export async function apiLogin({ username, password }) {
  const res = await api.post("/api/auth/login/", { username, password });
  const { access, user, tenant } = res.data;
  return { access, user, tenant };
}

export async function apiMe() {
  const res = await api.get("/api/auth/me/");
  return res.data;
}

// Petit helper: fallback username si jamais l'email est absent (tests, etc.)
function makeFallbackUsername() {
  // user-xxxxxxxx (8 chars)
  const rand = Math.random().toString(36).slice(2, 10);
  return `user-${rand}`;
}

export async function apiRegister({
  email,
  password,
  tenant_name,
  domain,
  service_type,
  service_name,
  service_features,
  business_type,
  extra_services,
}) {
  // IMPORTANT:
  // - backend REQUIERT "username"
  // - pour éviter les collisions, on met username = email (unique) si possible
  // - sinon fallback random
  const safeEmail = (email || "").trim();
  const username = safeEmail ? safeEmail.toLowerCase() : makeFallbackUsername();

  const payload = {
    username,
    email: safeEmail, // backend accepte email vide, mais toi côté UI tu le demandes
    password,
    password_confirm: password,
    tenant_name: tenant_name || "Mon commerce",
    domain: domain || "food",
    business_type: business_type || "other",
    service_type: service_type || "other",
    service_name: service_name || "Principal",
    service_features: service_features || undefined,
    extra_services: Array.isArray(extra_services) ? extra_services : [],
  };

  const res = await api.post("/api/auth/register/", payload);
  return res.data;
}

export async function apiServices() {
  const res = await api.get("/api/auth/services/");
  return res.data;
}
