import axios from "axios";
import { clearToken, getStoredToken } from "./auth";

const defaultBackendURL = import.meta.env.DEV
  ? "http://localhost:8000"
  : "https://inventory-tool-plage.onrender.com";
const baseURL = import.meta.env.VITE_API_BASE_URL || defaultBackendURL;

export const api = axios.create({ baseURL });

export const setAuthToken = (token) => {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
};

const bootToken = getStoredToken?.() || "";
if (bootToken) setAuthToken(bootToken);

// -----------------------------
// Service context (multi-service)
// -----------------------------
const SERVICE_KEY = "serviceId";
const LAST_SERVICE_KEY = "lastConcreteServiceId";

api.interceptors.request.use((config) => {
  const method = String(config?.method || "get").toLowerCase();
  if (typeof navigator !== "undefined" && !navigator.onLine && method !== "get") {
    const error = new Error("offline");
    error.isOffline = true;
    return Promise.reject(error);
  }
  return config;
});

function getStoredServiceIdSafe() {
  try {
    return localStorage.getItem(SERVICE_KEY) || "";
  } catch {
    return "";
  }
}

function getLastConcreteServiceId() {
  try {
    return localStorage.getItem(LAST_SERVICE_KEY) || "";
  } catch {
    return "";
  }
}

function setLastConcreteServiceId(id) {
  try {
    if (!id) return;
    localStorage.setItem(LAST_SERVICE_KEY, String(id));
  } catch {
    // noop
  }
}

/**
 * Returns { mode, serviceIdToSend, shouldSendServiceId }
 * - mode: raw stored value (ex: "12" or "all")
 * - serviceIdToSend: concrete id (string) if applicable
 * - shouldSendServiceId: false when mode === "all" (important!)
 */
function resolveServiceContext() {
  const mode = String(getStoredServiceIdSafe() || "").trim();
  if (!mode) return { mode: "", serviceIdToSend: "", shouldSendServiceId: false };

  if (mode === "all") {
    // IMPORTANT: for "all", do not send X-Service-Id (let backend know it's "all")
    return { mode, serviceIdToSend: "", shouldSendServiceId: false };
  }

  return { mode, serviceIdToSend: mode, shouldSendServiceId: true };
}

api.interceptors.request.use((config) => {
  // Allow opt-out per request (useful when querystring explicitly drives "service")
  if (config?.skipServiceContext) return config;

  // If caller explicitly set service headers, do not override
  const alreadySetMode = Boolean(config?.headers && "X-Service-Mode" in config.headers);
  const alreadySetId = Boolean(config?.headers && "X-Service-Id" in config.headers);
  if (alreadySetMode || alreadySetId) return config;

  const { mode, serviceIdToSend, shouldSendServiceId } = resolveServiceContext();
  if (!mode) return config;

  config.headers = config.headers || {};
  config.headers["X-Service-Mode"] = mode;

  if (shouldSendServiceId && serviceIdToSend) {
    config.headers["X-Service-Id"] = serviceIdToSend;
    setLastConcreteServiceId(serviceIdToSend);
  }

  return config;
});

// -----------------------------
// Friendly errors
// -----------------------------
function extractErrorCode(error) {
  const data = error?.response?.data;
  return (data?.code || data?.detail?.code || "").toString();
}

function buildFriendlyMessage(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const code = extractErrorCode(error);

  if (!error?.response) {
    return "Impossible de joindre le service. Vérifie ta connexion internet, puis réessaie.";
  }

  if (code === "email_not_verified") {
    return "Email non vérifié. Vérifie ta boîte mail (et les spams) puis clique sur le lien de confirmation.";
  }

  if (status === 503 || code === "db_unavailable") {
    return "Le service est temporairement indisponible. Réessaie dans quelques instants.";
  }

  if (status === 406) {
    return "Export indisponible pour le moment. Réessaie, ou contacte le support si ça persiste.";
  }

  if (status >= 500) {
    return "Une erreur est survenue côté serveur. Réessaie dans quelques instants.";
  }

  if (data?.detail && typeof data.detail === "string") return data.detail;
  if (data?.error && typeof data.error === "string") return data.error;

  if (status === 401) return "Connexion requise. Merci de te reconnecter.";

  return null;
}

function isAuthPage(pathname) {
  const p = String(pathname || "");
  return (
    p.startsWith("/login") ||
    p.startsWith("/register") ||
    p.startsWith("/check-email") ||
    p.startsWith("/verify-email") ||
    p.startsWith("/reset-password")
  );
}

function isAuthEndpoint(url) {
  const u = String(url || "");
  return (
    u.includes("/api/auth/login/") ||
    u.includes("/api/auth/register/") ||
    u.includes("/api/auth/verify-email/") ||
    u.includes("/api/auth/password-reset/") ||
    u.includes("/api/auth/email-change/")
  );
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.isOffline) {
      error.friendlyMessage = "Vous êtes hors ligne. Cette action nécessite une connexion.";
      return Promise.reject(error);
    }
    const status = error?.response?.status;
    const code = extractErrorCode(error);
    const reqUrl = error?.config?.url || "";

    // Gestion limites / plan
    if (status === 403) {
      const c = error.response?.data?.code;
      if (c && String(c).startsWith("LIMIT_EXPORT_")) {
        error.friendlyMessage =
          error.response?.data?.detail ||
          "Limite d’export mensuelle atteinte. Passez à un plan supérieur pour continuer.";
      } else if (c && String(c).startsWith("LIMIT_")) {
        error.friendlyMessage =
          error.response?.data?.detail ||
          "Action bloquée : vous avez atteint la limite de votre plan. Lecture et export restent possibles.";
      } else if (c === "FEATURE_NOT_INCLUDED") {
        error.friendlyMessage =
          error.response?.data?.detail || "Cette fonctionnalité nécessite un plan supérieur.";
      }
    }

    if (!error.friendlyMessage) {
      const msg = buildFriendlyMessage(error);
      if (msg) error.friendlyMessage = msg;
    }

    // 401 handling
    if (status === 401) {
      // ne pas logout/redirect si email non vérifié
      if (code === "email_not_verified") {
        error.friendlyMessage =
          error.friendlyMessage || "Email non vérifié. Vérifie ta boîte mail pour activer ton compte.";
        return Promise.reject(error);
      }

      // ne pas être agressif sur les endpoints auth (login/register/etc.)
      if (isAuthEndpoint(reqUrl)) {
        return Promise.reject(error);
      }

      clearToken();

      const path = window.location.pathname || "";
      if (!isAuthPage(path)) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

// -----------------------------
// Billing helpers (Stripe)
// -----------------------------
function requireAuthOrRedirect(nextUrl) {
  const token = getStoredToken?.();
  if (!token) {
    const next = encodeURIComponent(nextUrl || window.location.pathname + window.location.search);
    window.location.href = `/login?next=${next}`;
    return false;
  }
  return true;
}

export async function startCheckoutSession({ plan, cycle }) {
  if (!requireAuthOrRedirect("/tarifs")) return null;

  const payload = {
    plan_code: String(plan || "").toUpperCase(),
    cycle: String(cycle || "MONTHLY").toUpperCase(),
  };

  const res = await api.post("/api/auth/billing/checkout/", payload);
  const url = res?.data?.url;
  if (!url) throw new Error("URL Stripe manquante.");
  return url;
}

export async function openBillingPortal() {
  if (!requireAuthOrRedirect("/settings")) return null;

  const res = await api.post("/api/auth/billing/portal/", {});
  const url = res?.data?.url;
  if (!url) throw new Error("URL portail Stripe manquante.");
  return url;
}

// -----------------------------
// Export helpers
// -----------------------------
export async function downloadInventoryExcel({ month }) {
  if (!month) throw new Error("Mois requis.");

  const res = await api.get(`/api/export-excel/?month=${encodeURIComponent(month)}`, {
    responseType: "blob",
    headers: { Accept: "*/*" },
  });

  return res?.data;
}

// -----------------------------
// Account security helpers
// -----------------------------
export async function requestPasswordReset({ email, username } = {}) {
  const payload = {};
  if (email) payload.email = email;
  if (username) payload.username = username;
  const res = await api.post("/api/auth/password-reset/", payload);
  return res?.data;
}

export async function confirmPasswordReset({ uid, token, new_password, new_password_confirm }) {
  const res = await api.post("/api/auth/password-reset/confirm/", {
    uid,
    token,
    new_password,
    new_password_confirm,
  });
  return res?.data;
}

export async function requestEmailChange({ email }) {
  const res = await api.post("/api/auth/email-change/", { email });
  return res?.data;
}

export async function resendVerificationEmail({ email }) {
  const res = await api.post("/api/auth/verify-email/resend/", { email });
  return res?.data;
}

export async function deleteMyAccount() {
  const res = await api.delete("/api/auth/delete-account/");
  return res?.data;
}
