const TABLE_SERVICE_TYPES = new Set(["kitchen", "restaurant_dining", "bar", "bakery"]);

const isTableService = (serviceType) => TABLE_SERVICE_TYPES.has(String(serviceType || ""));

export function getPosUiCopy(serviceType) {
  if (isTableService(serviceType)) {
    return {
      title: "Votre caisse pour la salle et le comptoir",
      subtitle: "Encaissez plus vite, gardez la main sur vos ventes, sans friction.",
      highlights: [
        "Encaissement rapide par table ou au comptoir.",
        "Remises simples et paiements multi‑modes.",
        "Rapports de ventes clairs et exportables.",
      ],
    };
  }

  return {
    title: "Votre caisse à portée de main",
    subtitle: "Encaissez, suivez vos ventes et exportez vos rapports.",
    highlights: [
      "Encaissement rapide et panier clair.",
      "Remises simples et paiements multi‑modes.",
      "Rapports de ventes clairs et exportables.",
    ],
  };
}

export function getKdsUiCopy(serviceType) {
  if (isTableService(serviceType)) {
    return {
      title: "Réduisez vos pas : Salle → Cuisine en temps réel",
      subtitle: "Prise de commande, écran cuisine, statuts clairs, zéro confusion.",
      highlights: [
        "Commandes envoyées en cuisine en un clic.",
        "Écran cuisine lisible et mis à jour en continu.",
        "Statuts prêts/servis pour fluidifier le service.",
      ],
    };
  }

  return {
    title: "Commandes & cuisine, sans friction",
    subtitle: "Un flux simple pour préparer, suivre, servir.",
    highlights: [
      "Commandes visibles en un clin d’œil.",
      "Statuts simples pour piloter la préparation.",
      "Moins d’allers‑retours, plus de clarté.",
    ],
  };
}
