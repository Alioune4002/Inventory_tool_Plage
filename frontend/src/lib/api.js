
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
    // Optionnel: utile pour debug / analytics
    config.headers["X-Service-Mode"] = String(getStoredServiceIdSafe() || "");
    setLastConcreteServiceId(svc);
  }
  return config;
});

// -----------------------------
// Friendly errors
// -----------------------------
function buildFriendlyMessage(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const code = data?.code;

  if (!error?.response) {
    return "Impossible de joindre le service. Vérifie ta connexion internet, puis réessaie.";
  }

  if (status === 503 || code === "db_unavailable") {
    return "Le service est temporairement indisponible. Réessaie dans quelques instants.";
  }

  if (status === 401) {
    return "Connexion requise. Merci de te reconnecter.";
  }

  if (status === 406) {
    return "Export indisponible pour le moment. Réessaie, ou contacte le support si ça persiste.";
  }

  if (status >= 500) {
    return "Une erreur est survenue côté serveur. Réessaie dans quelques instants.";
  }

  if (data?.detail && typeof data.detail === "string") return data.detail;
  if (data?.error && typeof data.error === "string") return data.error;

  return null;
}

// Déconnexion silencieuse en cas de 401 (mais avec message propre)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Gestion limites/plan
    if (error?.response?.status === 403) {
      const code = error.response?.data?.code;
      if (code && String(code).startsWith("LIMIT_")) {
        const detail =
          error.response?.data?.detail ||
          "Action bloquée : vous avez atteint la limite de votre plan. Lecture et export restent possibles.";
        error.friendlyMessage = detail;
      } else if (code === "FEATURE_NOT_INCLUDED") {
        const detail =
          error.response?.data?.detail || "Cette fonctionnalité nécessite un plan supérieur.";
        error.friendlyMessage = detail;
      }
    }

    if (!error.friendlyMessage) {
      const msg = buildFriendlyMessage(error);
      if (msg) error.friendlyMessage = msg;
    }

    // Auth expirée
    if (error?.response?.status === 401) {
      clearToken();
      const path = window.location.pathname || "";
      const isAuthPage = path.startsWith("/login") || path.startsWith("/register");
      if (!isAuthPage) {
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
// Export helpers (avoid 406)
// -----------------------------
export async function downloadInventoryExcel({ month }) {
  if (!month) throw new Error("Mois requis.");

  const res = await api.get(`/api/export-excel/?month=${encodeURIComponent(month)}`, {
    responseType: "blob",
    headers: {
      Accept: "*/*",
    },
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