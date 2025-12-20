const FAMILLES = [
  {
    id: "retail",
    name: "Retail alimentaire",
    copy: {
      headline: "Épicerie & magasin généraliste : stock clair et rapide",
      subline: "Rayons lisibles, barcode par défaut, DLC activable.",
      seoKeywords: ["épicerie", "magasin généraliste", "inventaire alimentaire", "stock retail"],
      landing: {
        title: "Inventaire retail alimentaire",
        description: "Gérez vos rayons et vos stocks alimentaires avec une expérience pensée pour l’épicerie.",
      },
    },
    identifiers: {
      barcode: true,
      sku: false,
      expiry: true,
    },
    modules: ["pricing", "identifier", "expiry", "multiUnit"],
    defaults: {
      categoryLabel: "Rayon",
      unitLabel: "unité",
    },
    examples: {
      categories: ["Frais", "Épicerie", "Boissons"],
      products: ["Lait demi-écrémé", "Pâtes", "Eau 1,5L"],
    },
  },
  {
    id: "mode",
    name: "Mode & accessoires",
    copy: {
      headline: "Collections et références mode sans champs inutiles",
      subline: "SKU prioritaire, variantes tailles/couleurs, pricing activé.",
      seoKeywords: ["mode", "boutique", "vêtements", "accessoires", "SKU"],
      landing: {
        title: "Inventaire mode & accessoires",
        description: "SKU, collections, variantes : tout est taillé pour les boutiques mode.",
      },
    },
    identifiers: {
      barcode: false,
      sku: true,
      expiry: false,
    },
    modules: ["pricing", "identifier", "variants"],
    defaults: {
      categoryLabel: "Collection",
      unitLabel: "pièce",
    },
    examples: {
      categories: ["Capsule été", "Accessoires", "Maroquinerie"],
      products: ["T-shirt coton", "Ceinture cuir", "Sac bandoulière"],
    },
  },
  {
    id: "bar",
    name: "Bar & boissons",
    copy: {
      headline: "Bouteilles, softs et caves suivis sans friction",
      subline: "Entamé, lots et unités adaptées aux boissons.",
      seoKeywords: ["bar", "boissons", "cave", "inventaire bar"],
      landing: {
        title: "Inventaire bar & cave",
        description: "Suivi des bouteilles, pertes et contenants entamés en un clin d’œil.",
      },
    },
    identifiers: {
      barcode: true,
      sku: false,
      expiry: true,
    },
    modules: ["pricing", "identifier", "expiry", "opened", "lot", "multiUnit"],
    defaults: {
      categoryLabel: "Famille",
      unitLabel: "bouteille",
    },
    examples: {
      categories: ["Spiritueux", "Bières", "Softs"],
      products: ["Gin 70cl", "IPA 33cl", "Tonic"],
    },
  },
  {
    id: "restauration",
    name: "Restauration",
    copy: {
      headline: "Matières premières & produits finis, sans complexité",
      subline: "Inventaires séparés ou regroupés selon vos équipes.",
      seoKeywords: ["restauration", "cuisine", "stock cuisine", "inventaire restaurant"],
      landing: {
        title: "Inventaire restauration",
        description: "Cuisine et salle alignées avec des modules pensés pour la restauration.",
      },
    },
    identifiers: {
      barcode: true,
      sku: true,
      expiry: true,
    },
    modules: ["pricing", "identifier", "expiry", "lot", "opened", "multiUnit", "itemType"],
    defaults: {
      categoryLabel: "Poste",
      unitLabel: "portion",
    },
    examples: {
      categories: ["Cuisine", "Salle", "Prépa froide"],
      products: ["Filet de poulet", "Sauce maison", "Garniture"],
    },
  },
  {
    id: "boulangerie",
    name: "Boulangerie & pâtisserie",
    copy: {
      headline: "Fournées et préparations maison suivies proprement",
      subline: "Lots + DLC + multi-unités pour pains et pâtisseries.",
      seoKeywords: ["boulangerie", "pâtisserie", "fournées", "inventaire"],
      landing: {
        title: "Inventaire boulangerie & pâtisserie",
        description: "Des champs adaptés aux fournées, lots et produits finis.",
      },
    },
    identifiers: {
      barcode: true,
      sku: true,
      expiry: true,
    },
    modules: ["pricing", "identifier", "expiry", "lot", "opened", "multiUnit", "itemType"],
    defaults: {
      categoryLabel: "Fournée",
      unitLabel: "pièce",
    },
    examples: {
      categories: ["Pains", "Viennoiseries", "Pâtisseries"],
      products: ["Baguette tradition", "Croissant", "Tarte pommes"],
    },
  },
  {
    id: "pharmacie",
    name: "Pharmacie & parapharmacie",
    copy: {
      headline: "Traçabilité et lots pour le stock santé",
      subline: "Barcode + SKU + DLC/DDM pour rester conforme.",
      seoKeywords: ["pharmacie", "parapharmacie", "traçabilité", "DLC", "DDM"],
      landing: {
        title: "Inventaire pharmacie & parapharmacie",
        description: "Traçabilité renforcée pour médicaments, soins et parapharmacie.",
      },
    },
    identifiers: {
      barcode: true,
      sku: true,
      expiry: true,
    },
    modules: ["pricing", "identifier", "expiry", "lot"],
    defaults: {
      categoryLabel: "Rayon",
      unitLabel: "boîte",
    },
    examples: {
      categories: ["Dermocosmétique", "Hygiène", "Soins"],
      products: ["Doliprane 1g", "Crème mains", "Shampooing"],
    },
  },
];

const MODULES = [
  {
    id: "pricing",
    name: "Pricing & TVA",
    description:
      "Déclarez prix d'achat, prix de vente et taux de TVA (0%, 5.5%, 10%, 20%) pour déduire marge et CA estimé.",
    families: ["retail", "mode", "bar", "restauration", "boulangerie", "pharmacie"],
  },
  {
    id: "identifier",
    name: "Identifiant (Barcode / SKU)",
    description: "Choisissez votre référentiel (barcode prioritaire ou SKU selon famille).",
    families: ["retail", "mode", "bar", "restauration", "boulangerie", "pharmacie"],
  },
  {
    id: "expiry",
    name: "DLC / DDM",
    description: "Ajoute les champs de péremption sur inventaire & export.",
    families: ["retail", "bar", "restauration", "boulangerie", "pharmacie"],
  },
  {
    id: "lot",
    name: "Lot / Batch",
    description: "Associez chaque item à un lot et exportez l’historique de traçabilité.",
    families: ["bar", "restauration", "boulangerie", "pharmacie"],
  },
  {
    id: "variants",
    name: "Variantes",
    description: "Gérez tailles / couleurs / formats pour les collections.",
    families: ["mode"],
  },
  {
    id: "opened",
    name: "Ouvert / Entamé",
    description: "Suivi des contenants entamés pour bar, restauration, boulangerie.",
    families: ["bar", "restauration", "boulangerie"],
  },
  {
    id: "itemType",
    name: "Matières premières / Produits finis",
    description:
      "Classez vos articles (matière première, produit fini, préparation maison) pour mieux lire les marges.",
    families: ["restauration", "boulangerie"],
  },
  {
    id: "multiUnit",
    name: "Multi-unités",
    description: "Conversions d’unités (kg ↔ pièce ↔ L) selon vos besoins.",
    families: ["retail", "bar", "restauration", "boulangerie"],
  },
];

const DEFAULT_MODULES = {
  retail: ["pricing", "identifier", "expiry", "multiUnit"],
  mode: ["pricing", "identifier", "variants"],
  bar: ["pricing", "identifier", "expiry", "opened", "lot", "multiUnit"],
  restauration: ["pricing", "identifier", "expiry", "lot", "opened", "multiUnit", "itemType"],
  boulangerie: ["pricing", "identifier", "expiry", "lot", "opened", "multiUnit", "itemType"],
  pharmacie: ["pricing", "identifier", "expiry", "lot"],
};

const SERVICE_FAMILY_MAP = {
  pharmacy_parapharmacy: "pharmacie",
  bar: "bar",
  kitchen: "restauration",
  restaurant_dining: "restauration",
  bakery: "boulangerie",
  grocery_food: "retail",
  bulk_food: "retail",
  retail_general: "mode",
};

function resolveFamilyId(serviceType, domain) {
  if (SERVICE_FAMILY_MAP[serviceType]) return SERVICE_FAMILY_MAP[serviceType];
  if (domain === "general") return "mode";
  return "retail";
}

export { FAMILLES, MODULES, DEFAULT_MODULES };
export { resolveFamilyId };
