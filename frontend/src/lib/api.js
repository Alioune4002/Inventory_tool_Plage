// frontend/src/lib/api.js
import axios from "axios";
import { clearToken, getStoredToken } from "./auth";

const defaultBackendURL = "https://inventory-tool-plage.onrender.com";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || defaultBackendURL,
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

const bootToken = getStoredToken?.() || "";
if (bootToken) setAuthToken(bootToken);

// -----------------------------
// Service context (multi-service)
// -----------------------------
const SERVICE_KEY = "serviceId";
const LAST_SERVICE_KEY = "lastConcreteServiceId";

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

function resolveServiceHeaderValue() {
  const current = String(getStoredServiceIdSafe() || "").trim();
  if (!current) return "";
  if (current === "all") {
    // En mode "Tous les services" (lecture), les endpoints write doivent
    // quand même avoir un contexte => on fallback sur le dernier service concret.
    return String(getLastConcreteServiceId() || "").trim();
  }
  return current;
}

// Inject header for every request
api.interceptors.request.use((config) => {
  const svc = resolveServiceHeaderValue();
  if (svc) {
    config.headers = config.headers || {};
    config.headers["X-Service-Id"] = svc;
    config.headers["X-Service-Mode"] = String(getStoredServiceIdSafe() || "");
    setLastConcreteServiceId(svc);
  }
  return config;
});

// -----------------------------
// Friendly errors
// -----------------------------
function extractErrorCode(error) {
  const data = error?.response?.data;
  // DRF AuthenticationFailed peut renvoyer {detail, code} ou parfois detail string
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

  // DRF standard
  if (data?.detail && typeof data.detail === "string") return data.detail;
  if (data?.error && typeof data.error === "string") return data.error;

  // 401 générique (identifiants, token, etc.)
  if (status === 401) return "Connexion requise. Merci de te reconnecter.";

  return null;
}

function isAuthPagePath(pathname) {
  const p = String(pathname || "");
  return p.startsWith("/login") || p.startsWith("/register") || p.startsWith("/check-email");
}

function isAuthEndpoint(url) {
  const u = String(url || "");
  // endpoints d’auth où un 401 ne doit pas provoquer un logout/redirect agressif
  return (
    u.includes("/api/auth/login/") ||
    u.includes("/api/auth/register/") ||
    u.includes("/api/auth/verify-email/") ||
    u.includes("/api/auth/password-reset/") ||
    u.includes("/api/auth/email-change/")
  );
}

// Déconnexion silencieuse en cas de 401 (mais avec exceptions)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const code = extractErrorCode(error);

    // Gestion limites/plan
    if (status === 403) {
      const c = error.response?.data?.code;
      if (c && String(c).startsWith("LIMIT_")) {
        const detail =
          error.response?.data?.detail ||
          "Action bloquée : vous avez atteint la limite de votre plan. Lecture et export restent possibles.";
        error.friendlyMessage = detail;
      } else if (c === "FEATURE_NOT_INCLUDED") {
        const detail = error.response?.data?.detail || "Cette fonctionnalité nécessite un plan supérieur.";
        error.friendlyMessage = detail;
      }
    }

    if (!error.friendlyMessage) {
      const msg = buildFriendlyMessage(error);
      if (msg) error.friendlyMessage = msg;
    }

    if (error?.response?.status === 401) {
  const code = error?.response?.data?.code;

  // IMPORTANT : ne pas logout / redirect si email non vérifié
  if (code === "email_not_verified") {
    error.friendlyMessage =
      error.friendlyMessage ||
      "Email non vérifié. Vérifie ta boîte mail pour activer ton compte.";
    return Promise.reject(error);
  }

  clearToken();
  const path = window.location.pathname || "";
  const isAuthPage = path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/check-email");
  if (!isAuthPage) window.location.href = "/login";
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
// Export helpers (avoid 406)
// -----------------------------
export async function downloadInventoryExcel({ month }) {
  if (!month) throw new Error("Mois requis.");

  const res = await api.get(`/api/export-excel/?month=${encodeURIComponent(month)}`, {
    responseType: "blob",
    headers: { Accept: "*/*" },
  });

  return res?.data; // blob
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