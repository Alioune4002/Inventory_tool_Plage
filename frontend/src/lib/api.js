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

function buildFriendlyMessage(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const code = data?.code;

  // Pas de réponse => réseau/CORS/back down
  if (!error?.response) {
    return "Impossible de joindre le service. Vérifie ta connexion internet, puis réessaie.";
  }

  if (status === 503 || code === "db_unavailable") {
    return "Le service est temporairement indisponible. Réessaie dans quelques instants.";
  }

  if (status === 401) {
    // Laisse Login/Register gérer précisément si besoin
    return "Connexion requise. Merci de te reconnecter.";
  }

  if (status >= 500) {
    return "Une erreur est survenue côté serveur. Réessaie dans quelques instants.";
  }

  // DRF: detail
  if (data?.detail && typeof data.detail === "string") return data.detail;

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
        const detail = error.response?.data?.detail || "Cette fonctionnalité nécessite un plan supérieur.";
        error.friendlyMessage = detail;
      }
    }

    // Friendly global
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