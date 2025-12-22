const FAMILLES = [
  {
    id: "retail",
    name: "Retail alimentaire",
    copy: {
      headline: "Epicerie & magasin generaliste : stock clair et rapide",
      subline: "Rayons lisibles, code-barres par defaut, DLC activable.",
      seoKeywords: ["epicerie", "magasin generaliste", "inventaire alimentaire", "stock retail"],
      landing: {
        title: "Inventaire retail alimentaire",
        description: "Gerez vos rayons et vos stocks alimentaires avec une experience pensee pour l'epicerie.",
      },
      faq: [
        {
          q: "Le scan est-il obligatoire ?",
          a: "Non. Vous pouvez aussi utiliser un SKU interne, mais le scan evite les doublons.",
        },
        {
          q: "Peut-on suivre les DLC/DDM ?",
          a: "Oui, activez le module DLC/DDM pour afficher les dates limites.",
        },
      ],
    },
    labels: {
      itemLabel: "Produit",
      itemPlural: "Produits",
      categoryLabel: "Rayon",
      skuLabel: "SKU interne",
      barcodeLabel: "Code-barres",
      serviceLabel: "Service",
    },
    placeholders: {
      name: "Ex. Coca 33cl",
      category: "Ex. Rayon frais",
      sku: "Ex. SKU-FOOD-001",
      brand: "Ex. Marque X",
      supplier: "Ex. Centrale / grossiste",
      notes: "Ex. Produit saisonnier",
    },
    identifiers: {
      barcode: true,
      sku: false,
      expiry: true,
    },
    modules: ["pricing", "identifier", "expiry", "multiUnit"],
    defaults: {
      categoryLabel: "Rayon",
      unitLabel: "unite",
    },
    examples: {
      categories: ["Frais", "Epicerie", "Boissons", "Surgeles"],
      products: ["Lait demi-ecreme", "Pates", "Eau 1,5L"],
    },
  },
  {
    id: "mode",
    name: "Mode & accessoires",
    copy: {
      headline: "Collections et references mode sans champs inutiles",
      subline: "SKU prioritaire, variantes tailles/couleurs, pricing active.",
      seoKeywords: ["mode", "boutique", "vetements", "accessoires", "SKU"],
      landing: {
        title: "Inventaire mode & accessoires",
        description: "SKU, collections, variantes : tout est taille pour les boutiques mode.",
      },
      faq: [
        {
          q: "Le code-barres est-il utile en mode ?",
          a: "Il est optionnel. Le SKU reste l'identifiant principal des collections.",
        },
        {
          q: "Puis-je suivre les tailles/couleurs ?",
          a: "Oui, activez le module Variantes pour tailles, couleurs et formats.",
        },
      ],
    },
    labels: {
      itemLabel: "Article",
      itemPlural: "Articles",
      categoryLabel: "Collection",
      skuLabel: "SKU / Ref.",
      barcodeLabel: "Code-barres (optionnel)",
      serviceLabel: "Service",
    },
    placeholders: {
      name: "Ex. T-shirt coton",
      category: "Ex. Collection ete / Accessoires",
      sku: "Ex. SKU-TSH-001",
      brand: "Ex. Atelier X",
      supplier: "Ex. Grossiste mode",
      notes: "Ex. Serie limitee",
    },
    identifiers: {
      barcode: false,
      sku: true,
      expiry: false,
    },
    modules: ["pricing", "identifier", "variants"],
    defaults: {
      categoryLabel: "Collection",
      unitLabel: "piece",
    },
    examples: {
      categories: ["Capsule ete", "Accessoires", "Maroquinerie"],
      products: ["T-shirt coton", "Ceinture cuir", "Sac bandouliere"],
    },
  },
  {
    id: "bar",
    name: "Bar & boissons",
    copy: {
      headline: "Bouteilles, softs et caves suivis sans friction",
      subline: "Entame, lots et unites adaptees aux boissons.",
      seoKeywords: ["bar", "boissons", "cave", "inventaire bar"],
      landing: {
        title: "Inventaire bar & cave",
        description: "Suivi des bouteilles, pertes et contenants entames en un clin d'oeil.",
      },
      faq: [
        {
          q: "Puis-je suivre les bouteilles entamees ?",
          a: "Oui, activez le module Ouvert / Entame.",
        },
        {
          q: "Peut-on gerer les lots ?",
          a: "Oui, le module Lot/Batch est disponible pour la tracabilite.",
        },
      ],
    },
    labels: {
      itemLabel: "Reference bar",
      itemPlural: "References bar",
      categoryLabel: "Famille",
      skuLabel: "SKU bar",
      barcodeLabel: "Code-barres",
      serviceLabel: "Service",
    },
    placeholders: {
      name: "Ex. Gin 70cl",
      category: "Ex. Spiritueux / Bieres",
      sku: "Ex. SKU-BAR-GIN-001",
      brand: "Ex. Distillerie X",
      supplier: "Ex. Grossiste boissons",
      notes: "Ex. Rotation lente",
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
      categories: ["Spiritueux", "Bieres", "Softs"],
      products: ["Gin 70cl", "IPA 33cl", "Tonic"],
    },
  },
  {
    id: "restauration",
    name: "Restauration",
    copy: {
      headline: "Matieres premieres & produits finis, sans complexite",
      subline: "Inventaires separes ou regroupes selon vos equipes.",
      seoKeywords: ["restauration", "cuisine", "stock cuisine", "inventaire restaurant"],
      landing: {
        title: "Inventaire restauration",
        description: "Cuisine et salle alignees avec des modules penses pour la restauration.",
      },
      faq: [
        {
          q: "Cuisine et salle peuvent-elles etre separees ?",
          a: "Oui, vous choisissez regrouper ou separer lors de l'onboarding.",
        },
        {
          q: "Peut-on distinguer matieres premieres et produits finis ?",
          a: "Oui, activez le module Matiere premiere / Produit fini.",
        },
      ],
    },
    labels: {
      itemLabel: "Produit cuisine",
      itemPlural: "Produits cuisine",
      categoryLabel: "Poste",
      skuLabel: "SKU interne",
      barcodeLabel: "Code-barres",
      serviceLabel: "Service",
    },
    placeholders: {
      name: "Ex. Filet de poulet",
      category: "Ex. Prep froide / Grill",
      sku: "Ex. SKU-KIT-001",
      brand: "Ex. Maison",
      supplier: "Ex. Marche local",
      notes: "Ex. Preparation maison",
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
      categories: ["Cuisine", "Salle", "Prepa froide"],
      products: ["Filet de poulet", "Sauce maison", "Garniture"],
    },
  },
  {
    id: "boulangerie",
    name: "Boulangerie & patisserie",
    copy: {
      headline: "Fournees et preparations maison suivies proprement",
      subline: "Lots + DLC + multi-unites pour pains et patisseries.",
      seoKeywords: ["boulangerie", "patisserie", "fournees", "inventaire"],
      landing: {
        title: "Inventaire boulangerie & patisserie",
        description: "Des champs adaptes aux fournees, lots et produits finis.",
      },
      faq: [
        {
          q: "Peut-on suivre les fournees et la production ?",
          a: "Oui, les categories et modules sont adaptes aux fournees.",
        },
        {
          q: "Le suivi des lots est-il disponible ?",
          a: "Oui, activez Lot/Batch pour la tracabilite.",
        },
      ],
    },
    labels: {
      itemLabel: "Produit boulangerie",
      itemPlural: "Produits boulangerie",
      categoryLabel: "Fournee",
      skuLabel: "SKU boulangerie",
      barcodeLabel: "Code-barres",
      serviceLabel: "Service",
    },
    placeholders: {
      name: "Ex. Farine T55 25kg",
      category: "Ex. Ingrédients / Viennoiseries",
      sku: "Ex. SKU-BAK-001",
      brand: "Ex. Moulin X",
      supplier: "Ex. Fournisseur farine",
      notes: "Ex. Allergènes: gluten",
    },
    identifiers: {
      barcode: true,
      sku: true,
      expiry: true,
    },
    modules: ["pricing", "identifier", "expiry", "lot", "opened", "multiUnit", "itemType"],
    defaults: {
      categoryLabel: "Fournee",
      unitLabel: "piece",
    },
    examples: {
      categories: ["Pains", "Viennoiseries", "Patisseries"],
      products: ["Baguette tradition", "Croissant", "Tarte pommes"],
    },
  },
  {
    id: "pharmacie",
    name: "Pharmacie & parapharmacie",
    copy: {
      headline: "Tracabilite et lots pour le stock sante",
      subline: "Code-barres + SKU + DLC/DDM pour rester conforme.",
      seoKeywords: ["pharmacie", "parapharmacie", "tracabilite", "DLC", "DDM"],
      landing: {
        title: "Inventaire pharmacie & parapharmacie",
        description: "Tracabilite renforcee pour medicaments, soins et parapharmacie.",
      },
      faq: [
        {
          q: "Le CIP est-il gere ?",
          a: "Oui, le code-barres est prioritaire pour retrouver vos produits.",
        },
        {
          q: "Lots et dates limites sont-ils disponibles ?",
          a: "Oui, activez les modules Lot et DLC/DDM.",
        },
      ],
    },
    labels: {
      itemLabel: "Produit sante",
      itemPlural: "Produits sante",
      categoryLabel: "Rayon",
      skuLabel: "Code interne",
      barcodeLabel: "CIP / Code-barres",
      serviceLabel: "Service",
    },
    placeholders: {
      name: "Ex. Doliprane 1g",
      category: "Ex. Antalgique / Hygiene",
      sku: "Ex. SKU-PHA-001",
      brand: "Ex. Sanofi",
      supplier: "Ex. Centrale pharma",
      notes: "Ex. Necessite suivi lot",
    },
    identifiers: {
      barcode: true,
      sku: true,
      expiry: true,
    },
    modules: ["pricing", "identifier", "expiry", "lot"],
    defaults: {
      categoryLabel: "Rayon",
      unitLabel: "boite",
    },
    examples: {
      categories: ["Dermocosmetique", "Hygiene", "Soins"],
      products: ["Doliprane 1g", "Creme mains", "Shampooing"],
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
