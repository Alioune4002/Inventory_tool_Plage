export function formatApiError(error, options = {}) {
  const ctx = options?.context || ""; // "login" | "register" | "generic"
  const fallback =
    options?.fallback ||
    (ctx === "login"
      ? "Connexion impossible. Vérifie tes identifiants et réessaie."
      : ctx === "register"
        ? "Création impossible. Vérifie l’email, le mot de passe et le nom du commerce."
        : "Une erreur est survenue. Réessaie.");

  if (error?.friendlyMessage) return String(error.friendlyMessage);


  if (!error?.response) {
    return (
      (typeof error?.message === "string" && error.message.trim() && error.message) ||
      "Impossible de joindre le serveur. Vérifie ta connexion internet et réessaie."
    );
  }

  const data = error?.response?.data;
  const status = error?.response?.status;

  const looksLikeHtml = (value) =>
    typeof value === "string" && /<\s*(!doctype|html|head|body)\b/i.test(value);

  if (looksLikeHtml(data)) {
    return "Service indisponible pour le moment. Réessaie dans quelques instants.";
  }

  if (typeof data === "string") return data || fallback;

  const code = data?.code;
  if (code === "email_not_verified") {
    return "Email non vérifié. Vérifie ta boîte mail (et les spams) puis clique sur le lien de confirmation.";
  }
  if (code === "db_unavailable") {
    return "Service indisponible pour le moment. Réessaie dans quelques instants.";
  }

  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;

  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    return String(data.non_field_errors[0]);
  }

 
  if (data && typeof data === "object") {
    const parts = [];

    const addValue = (val) => {
      if (!val) return;
      if (Array.isArray(val)) {
        const msg = val.filter(Boolean).join(" · ");
        if (msg) parts.push(msg);
        return;
      }
      if (typeof val === "string") {
        if (val.trim()) parts.push(val.trim());
        return;
      }
      
      parts.push("Informations invalides. Vérifie les champs et réessaie.");
    };

    Object.keys(data).forEach((key) => {
      if (key === "detail" || key === "code" || key === "non_field_errors") return;
      addValue(data[key]);
    });

    if (parts.length) return parts.join(" · ");
  }

  if (status === 401) return ctx === "login" ? "Identifiants incorrects." : fallback;
  if (status === 403) return "Accès refusé.";
  if (status >= 500) return "Service indisponible pour le moment. Réessaie dans quelques instants.";

  return fallback;
}