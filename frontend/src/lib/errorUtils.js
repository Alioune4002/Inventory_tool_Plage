export function formatApiError(error) {
  const data = error?.response?.data;
  if (!data) {
    return error?.message || "Erreur réseau. Vérifiez votre connexion.";
  }

  if (typeof data === "string") {
    return data;
  }

  const entries = [];
  const addEntry = (key, value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      entries.push(`${key}: ${value.join(" · ")}`);
    } else if (typeof value === "object") {
      entries.push(`${key}: ${JSON.stringify(value)}`);
    } else {
      entries.push(`${key}: ${value}`);
    }
  };

  if (data.detail) addEntry("detail", data.detail);
  if (data.non_field_errors) addEntry("erreur", data.non_field_errors);
  Object.keys(data).forEach((key) => {
    if (key === "detail" || key === "non_field_errors") return;
    addEntry(key, data[key]);
  });

  return entries.join(" · ") || "Erreur inattendue du serveur.";
}
