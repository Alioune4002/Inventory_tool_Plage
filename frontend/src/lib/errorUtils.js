// frontend/src/lib/errorUtils.js
export function formatApiError(error, options = {}) {
  const ctx = options?.context || ""; // ex: "login" | "register" | "generic"
  const fallback =
    options?.fallback ||
    (ctx === "login"
      ? "Connexion impossible. Vérifie tes identifiants et réessaie."
      : ctx === "register"
        ? "Création impossible. Vérifie l’email, le mot de passe et le nom du commerce."
        : "Une erreur est survenue. Réessaie.");

  // 1) friendlyMessage (injecté par api interceptor: LIMIT_ / FEATURE_NOT_INCLUDED)
  if (error?.friendlyMessage) return String(error.friendlyMessage);

  // 2) réseau / CORS / offline (axios: pas de response)
  if (!error?.response) {
    return (
      error?.message ||
      "Impossible de joindre le serveur. Vérifie ta connexion internet et réessaie."
    );
  }

  const data = error?.response?.data;
  const status = error?.response?.status;

  const looksLikeHtml = (value) =>
    typeof value === "string" && /<\s*(!doctype|html|head|body)\b/i.test(value);

  // 3) backend/proxy renvoie HTML
  if (looksLikeHtml(data)) {
    return "Service indisponible pour le moment. Réessaie dans quelques instants.";
  }

  // 4) string direct
  if (typeof data === "string") {
    return data || fallback;
  }

  // 5) cas connus (codes backend)
  const code = data?.code;
  if (code === "email_not_verified") {
    return "Email non vérifié. Vérifie ta boîte mail pour activer ton compte.";
  }
  if (code === "db_unavailable") {
    return "Service indisponible (base de données). Réessaie dans quelques instants.";
  }

  // 6) DRF standard
  if (typeof data?.detail === "string" && data.detail.trim()) {
    return data.detail;
  }

  // 7) non_field_errors
  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    return String(data.non_field_errors[0]);
  }

  // 8) champs de validation: { email: [...], password: [...] }
  if (data && typeof data === "object") {
    const parts = [];

    const addValue = (val) => {
      if (!val) return;
      if (Array.isArray(val)) {
        const msg = val.filter(Boolean).join(" · ");
        if (msg) parts.push(msg);
      } else if (typeof val === "object") {
        parts.push(JSON.stringify(val));
      } else if (typeof val === "string") {
        if (val.trim()) parts.push(val.trim());
      } else {
        parts.push(String(val));
      }
    };

    Object.keys(data).forEach((key) => {
      if (key === "detail" || key === "code" || key === "non_field_errors") return;
      addValue(data[key]);
    });

    if (parts.length) return parts.join(" · ");
  }

  // 9) fallback selon status
  if (status === 401) return ctx === "login" ? "Identifiants incorrects." : fallback;
  if (status === 403) return "Accès refusé.";
  if (status >= 500) return "Service indisponible pour le moment. Réessaie dans quelques instants.";

  return fallback;
}