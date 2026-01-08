const FAMILLES = [
  {
    id: "retail",
    name: "Épicerie & retail alimentaire",
    copy: {
      headline: "Un inventaire alimentaire plus rapide, plus fiable",
      subline:
        "Rayons clairs, produits sans doublons, dates (DLC/DDM) activables. Exports prêts pour l’équipe ou le comptable.",
      seoKeywords: ["épicerie", "magasin", "inventaire alimentaire", "gestion stock", "export Excel", "DLC", "DDM"],
      landing: {
        title: "Inventaire épicerie & retail alimentaire",
        description:
          "Gérez vos rayons et votre stock alimentaire avec une méthode simple : une base produits propre + un inventaire à une date.",
        problem:
          "En épicerie, les erreurs viennent vite : doublons, catégories incohérentes, dates à surveiller, unités qui varient… et l’inventaire devient trop long.",
        solution:
          "StockScan vous aide à garder une base produits claire, puis à faire un inventaire rapide par rayon, avec des options activables (dates, unités, prix/TVA) uniquement si nécessaire.",
        outcomes: [
          "Inventaire plus rapide, rayons mieux organisés",
          "Moins de doublons et de confusions",
          "Exports CSV/Excel propres et exploitables",
        ],
      },
      faq: [
        {
          q: "Le scan est-il obligatoire ?",
          a: "Non. Vous pouvez travailler sans code-barres. Une référence interne peut aider à éviter les doublons, mais elle reste optionnelle.",
        },
        {
          q: "Peut-on suivre les DLC/DDM ?",
          a: "Oui. Activez l’option DLC/DDM pour saisir et afficher les dates limites sur l’inventaire et les exports.",
        },
      ],
    },
    labels: {
      itemLabel: "Produit",
      itemPlural: "Produits",
      categoryLabel: "Rayon",
      skuLabel: "Référence interne",
      barcodeLabel: "Code-barres",
      serviceLabel: "Service",
    },
    placeholders: {
      name: "Ex. Lait demi-écrémé 1L",
      category: "Ex. Frais / Épicerie",
      sku: "Ex. REF-FOOD-001",
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
      unitLabel: "unité",
    },
    examples: {
      categories: ["Frais", "Épicerie", "Boissons", "Surgelés"],
      products: ["Lait demi-écrémé", "Pâtes", "Eau 1,5L"],
    },
  },

  {
    id: "mode",
    name: "Boutique, mode & accessoires",
    copy: {
      headline: "Une gestion de stock simple pour les boutiques !",
      subline:
        "Références internes prioritaires, collections claires, variantes (tailles/couleurs) activables. Pas de champs inutiles.",
      seoKeywords: ["boutique", "mode", "vêtements", "accessoires", "inventaire boutique", "référence interne"],
      landing: {
        title: "Inventaire boutique, mode & accessoires",
        description:
          "Organisez vos collections, vos références et vos variantes avec une interface pensée pour la vente au détail.",
        problem:
          "En boutique, le stock se complexifie vite : références internes, tailles, couleurs, collections… et les outils généralistes deviennent pénibles.",
        solution:
          "StockScan vous laisse démarrer simple (produits + collections), puis activer les variantes si vous en avez besoin. L’interface reste claire et rapide.",
        outcomes: [
          "Stock plus propre, moins de perte de temps",
          "Variantes activables sans complexifier le reste",
          "Exports lisibles pour réassort et suivi",
        ],
      },
      faq: [
        {
          q: "Le code-barres est-il indispensable ?",
          a: "Non. En boutique, la référence interne suffit souvent. Le code-barres peut être ajouté si vous l’utilisez déjà.",
        },
        {
          q: "Puis-je gérer tailles et couleurs ?",
          a: "Oui. Activez l’option Variantes pour suivre tailles, couleurs et formats.",
        },
      ],
    },
    labels: {
      itemLabel: "Article",
      itemPlural: "Articles",
      categoryLabel: "Collection",
      skuLabel: "Référence interne",
      barcodeLabel: "Code-barres (optionnel)",
      serviceLabel: "Service",
    },
    placeholders: {
      name: "Ex. T-shirt coton",
      category: "Ex. Collection été / Accessoires",
      sku: "Ex. REF-TSH-001",
      brand: "Ex. Atelier X",
      supplier: "Ex. Grossiste mode",
      notes: "Ex. Série limitée",
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
      headline: "Un inventaire bar sans prise de tête !",
      subline:
        "Bouteilles, softs, cave : unités adaptées, entamés optionnels, lots et dates activables. Exports directs.",
      seoKeywords: ["bar", "boissons", "inventaire bar", "cave", "bouteilles", "entamé"],
      landing: {
        title: "Inventaire bar & cave",
        description:
          "Suivez les bouteilles et boissons avec une structure claire : base produits + inventaire à une date, avec options bar (entamés, lots, dates).",
        problem:
          "En bar, on compte vite, on oublie des détails, et le stock réel ne correspond pas : unités (cl/L), bouteilles entamées, pertes… ça devient flou.",
        solution:
          "StockScan vous propose une base produits propre, des unités adaptées, et la possibilité d’activer le suivi des entamés, lots et dates si nécessaire.",
        outcomes: [
          "Inventaire plus rapide, moins d’oublis",
          "Meilleure cohérence sur les unités et contenants",
          "Exports propres pour suivi et contrôle",
        ],
      },
      faq: [
        {
          q: "Puis-je suivre les bouteilles entamées ?",
          a: "Oui. Activez l’option Ouvert / Entamé pour suivre les contenants ouverts (selon vos besoins).",
        },
        {
          q: "Peut-on gérer les lots ?",
          a: "Oui. L’option Lot/Batch est disponible pour la traçabilité.",
        },
      ],
    },
    labels: {
      itemLabel: "Produit bar",
      itemPlural: "Produits bar",
      categoryLabel: "Famille",
      skuLabel: "Référence interne",
      barcodeLabel: "Code-barres",
      serviceLabel: "Service",
    },
    placeholders: {
      name: "Ex. Gin 70cl",
      category: "Ex. Spiritueux / Bières",
      sku: "Ex. REF-BAR-GIN-001",
      brand: "Ex. Distillerie X",
      supplier: "Ex. Grossiste boissons",
      notes: "Ex. Rotation lente",
    },
    identifiers: {
      barcode: true,
      sku: false,
      expiry: true,
    },
    modules: ["pricing", "identifier", "expiry", "opened", "lot", "multiUnit", "kds"],
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
    name: "Restaurant & cuisine",
    copy: {
      headline: "Cuisine et salle alignées, inventaire enfin lisible",
      subline:
        "Séparez ou regroupez vos zones (cuisine/bar/salle), suivez pertes et options métier. Exports CSV/Excel.",
      seoKeywords: ["restaurant", "cuisine", "inventaire restaurant", "stock cuisine", "pertes", "export Excel"],
      landing: {
        title: "Inventaire restauration",
        description:
          "Une méthode simple : base produits propre + inventaire à une date, avec des options cuisine (pertes, lots, dates, matières premières/produits finis).",
        problem:
          "En restauration, l’inventaire devient vite une corvée : produits ouverts, dates, pertes, unités… et on n’a pas le temps de gérer une usine à gaz.",
        solution:
          "StockScan reste simple, et vous activez uniquement ce qui vous aide (pertes, lots, dates, entamés, matières premières / produits finis).",
        outcomes: [
          "Inventaire plus rapide et plus clair",
          "Meilleure lecture par zone / équipe",
          "Exports propres pour suivi et contrôle",
        ],
      },
      faq: [
        {
          q: "Cuisine et salle peuvent-elles être séparées ?",
          a: "Oui. Vous pouvez regrouper ou séparer vos zones (ex : cuisine / bar) selon votre organisation.",
        },
        {
          q: "Puis-je distinguer matières premières et produits finis ?",
          a: "Oui. Activez l’option Matières premières / Produits finis pour classer vos produits plus clairement.",
        },
      ],
    },
    labels: {
      itemLabel: "Produit",
      itemPlural: "Produits",
      categoryLabel: "Poste",
      skuLabel: "Référence interne",
      barcodeLabel: "Code-barres",
      serviceLabel: "Service",
    },
    placeholders: {
      name: "Ex. Filet de poulet",
      category: "Ex. Prépa froide / Grill",
      sku: "Ex. REF-KIT-001",
      brand: "Ex. Maison",
      supplier: "Ex. Marché local",
      notes: "Ex. Préparation maison",
    },
    identifiers: {
      barcode: true,
      sku: true,
      expiry: true,
    },
    modules: ["pricing", "identifier", "expiry", "lot", "opened", "multiUnit", "itemType", "kds"],
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
      headline: "Ingrédients, produits finis et fournées : tout devient plus net",
      subline:
        "Options lots, dates, multi-unités et classification. Inventaire simple, exports lisibles.",
      seoKeywords: ["boulangerie", "pâtisserie", "inventaire boulangerie", "production", "lots", "DLC", "DDM"],
      landing: {
        title: "Inventaire boulangerie & pâtisserie",
        description:
          "Une base produits claire + un inventaire à date, avec des options adaptées (lots, dates, multi-unités, matières premières / produits finis).",
        problem:
          "En boulangerie, on jongle entre ingrédients, productions, produits finis, pertes… et si tout est mélangé, on perd du temps.",
        solution:
          "StockScan structure vos produits, puis vous permet de faire un inventaire rapide. Vous activez les options utiles selon votre organisation.",
        outcomes: [
          "Meilleure organisation, moins d’erreurs",
          "Inventaire plus rapide sur les catégories clés",
          "Exports propres pour suivi et analyse",
        ],
      },
      faq: [
        {
          q: "Peut-on suivre la production / les fournées ?",
          a: "StockScan s’adapte à votre organisation via catégories et options. Vous pouvez structurer votre suivi selon vos besoins.",
        },
        {
          q: "Le suivi des lots est-il disponible ?",
          a: "Oui. Activez l’option Lot/Batch pour la traçabilité.",
        },
      ],
    },
    labels: {
      itemLabel: "Produit",
      itemPlural: "Produits",
      categoryLabel: "Fournée",
      skuLabel: "Référence interne",
      barcodeLabel: "Code-barres",
      serviceLabel: "Service",
    },
    placeholders: {
      name: "Ex. Farine T55 25kg",
      category: "Ex. Ingrédients / Viennoiseries",
      sku: "Ex. REF-BAK-001",
      brand: "Ex. Moulin X",
      supplier: "Ex. Fournisseur farine",
      notes: "Ex. Allergènes : gluten",
    },
    identifiers: {
      barcode: true,
      sku: true,
      expiry: true,
    },
    modules: ["pricing", "identifier", "expiry", "lot", "opened", "multiUnit", "itemType", "kds"],
    defaults: {
      categoryLabel: "Fournée",
      unitLabel: "pièce",
    },
    examples: {
      categories: ["Pains", "Viennoiseries", "Pâtisseries"],
      products: ["Baguette tradition", "Croissant", "Tarte aux pommes"],
    },
  },

  {
    id: "pharmacie",
    name: "Pharmacie & parapharmacie",
    copy: {
      headline: "Traçabilité renforcée, stock santé mieux maîtrisé",
      subline:
        "Code-barres (CIP), lots et dates activables. Exports structurés pour un suivi plus rigoureux.",
      seoKeywords: ["pharmacie", "parapharmacie", "traçabilité", "CIP", "lots", "péremption", "inventaire"],
      landing: {
        title: "Inventaire pharmacie & parapharmacie",
        description:
          "Suivez votre stock santé avec une structure claire et des options de traçabilité (lots, dates), activables selon vos besoins.",
        problem:
          "En pharmacie, le stock exige plus de rigueur : lots, dates, traçabilité… et un simple tableau devient vite insuffisant.",
        solution:
          "StockScan vous permet de structurer votre base produits et d’activer lots et dates lorsque vous en avez besoin, avec des exports propres.",
        outcomes: [
          "Traçabilité plus claire selon vos besoins",
          "Moins d’erreurs de suivi au quotidien",
          "Exports structurés et exploitables",
        ],
      },
      faq: [
        {
          q: "Le CIP est-il géré ?",
          a: "Oui. Le code-barres peut être utilisé comme identifiant principal pour retrouver vos produits.",
        },
        {
          q: "Lots et dates sont-ils disponibles ?",
          a: "Oui. Activez les options Lot/Batch et DLC/DDM pour renforcer la traçabilité.",
        },
      ],
    },
    labels: {
      itemLabel: "Produit santé",
      itemPlural: "Produits santé",
      categoryLabel: "Rayon",
      skuLabel: "Code interne",
      barcodeLabel: "CIP / Code-barres",
      serviceLabel: "Service",
    },
    placeholders: {
      name: "Ex. Doliprane 1g",
      category: "Ex. Antalgique / Hygiène",
      sku: "Ex. REF-PHA-001",
      brand: "Ex. Laboratoire X",
      supplier: "Ex. Centrale pharmacie",
      notes: "Ex. Suivi lot recommandé",
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
    name: "Prix & TVA",
    description:
      "Ajoutez prix d’achat, prix de vente et TVA pour mieux suivre votre stock (marges et estimations selon vos usages).",
    families: ["retail", "mode", "bar", "restauration", "boulangerie", "pharmacie"],
  },
  {
    id: "identifier",
    name: "Référence (code-barres / référence interne)",
    description:
      "Choisissez votre identifiant : code-barres si vous en avez, sinon une référence interne simple.",
    families: ["retail", "mode", "bar", "restauration", "boulangerie", "pharmacie"],
  },
  {
    id: "expiry",
    name: "Dates (DLC / DDM)",
    description: "Ajoute le suivi des dates sur l’inventaire et les exports.",
    families: ["retail", "bar", "restauration", "boulangerie", "pharmacie"],
  },
  {
    id: "lot",
    name: "Lots / Batch",
    description: "Associez des lots et exportez un historique de traçabilité (selon votre organisation).",
    families: ["bar", "restauration", "boulangerie", "pharmacie"],
  },
  {
    id: "variants",
    name: "Variantes",
    description: "Gérez tailles, couleurs et formats (utile pour la boutique / mode).",
    families: ["mode"],
  },
  {
    id: "opened",
    name: "Ouverts / entamés",
    description: "Suivi des contenants ouverts (utile pour bar, restauration, boulangerie).",
    families: ["bar", "restauration", "boulangerie"],
  },
  {
    id: "itemType",
    name: "Matières premières / produits finis",
    description:
      "Classez vos articles (matière première, produit fini, préparation) pour une lecture plus claire.",
    families: ["restauration", "boulangerie"],
  },
  {
    id: "kds",
    name: "Commandes & Cuisine (KDS)",
    description:
      "Prise de commande + écran cuisine. Idéal pour le service à table (restaurant, bar, salon de thé).",
    families: ["bar", "restauration", "boulangerie"],
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
