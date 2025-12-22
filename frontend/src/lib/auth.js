// src/lib/auth.js
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

export async function apiRegister({ email, password, tenant_name, domain, service_type, service_name, business_type, extra_services }) {
  const username = (email?.split("@")[0] || "user").slice(0, 20);
  const payload = {
    username,
    email,
    password,
    password_confirm: password,
    tenant_name: tenant_name || "Mon commerce",
    domain: domain || "food",
    business_type: business_type || "other",
    service_type,
    service_name,
    extra_services: extra_services || [],
  };
  const res = await api.post("/api/auth/register/", payload);
  return res.data;
}

export async function apiServices() {
  const res = await api.get("/api/auth/services/");
  return res.data;
}
