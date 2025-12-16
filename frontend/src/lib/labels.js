// frontend/src/lib/labels.js
// Centralise le wording + les textes UX + les placeholders selon service_type / domain.
// Objectif : expérience ultra personnalisée par métier, cohérente et maintenable.

export function getWording(serviceType, domain) {
  const isGeneral = domain === "general";

  switch (serviceType) {
    case "pharmacy_parapharmacy":
      return {
        itemLabel: "Produit santé",
        itemPlural: "Produits santé",
        categoryLabel: "Rayon",
        skuLabel: "Code interne",
        barcodeLabel: "CIP / Code-barres",
      };

    case "retail_general":
      return {
        itemLabel: "Article",
        itemPlural: "Articles",
        categoryLabel: "Catégorie",
        skuLabel: "SKU / Réf.",
        barcodeLabel: "Code-barres (optionnel)",
      };

    case "bar":
      return {
        itemLabel: "Référence bar",
        itemPlural: "Références bar",
        categoryLabel: "Famille (bar)",
        skuLabel: "SKU bar",
        barcodeLabel: "Code-barres (optionnel)",
      };

    case "kitchen":
      return {
        itemLabel: "Produit cuisine",
        itemPlural: "Produits cuisine",
        categoryLabel: "Famille",
        skuLabel: "SKU interne",
        barcodeLabel: "Code-barres (optionnel)",
      };

    case "bakery":
      return {
        itemLabel: "Produit boulangerie",
        itemPlural: "Produits boulangerie",
        categoryLabel: "Famille (boulangerie)",
        skuLabel: "SKU boulangerie",
        barcodeLabel: "Code-barres (optionnel)",
      };

    case "grocery_food":
      return {
        itemLabel: "Produit",
        itemPlural: "Produits",
        categoryLabel: "Catégorie",
        skuLabel: "SKU interne",
        barcodeLabel: "Code-barres",
      };

    case "bulk_food":
      return {
        itemLabel: "Produit vrac",
        itemPlural: "Produits vrac",
        categoryLabel: "Catégorie",
        skuLabel: "SKU vrac",
        barcodeLabel: "Code-barres (optionnel)",
      };

    default:
      if (isGeneral) {
        return {
          itemLabel: "Article",
          itemPlural: "Articles",
          categoryLabel: "Catégorie",
          skuLabel: "SKU / Réf.",
          barcodeLabel: "Code-barres (optionnel)",
        };
      }
      return {
        itemLabel: "Produit",
        itemPlural: "Produits",
        categoryLabel: "Catégorie",
        skuLabel: "SKU interne",
        barcodeLabel: "Code-barres",
      };
  }
}

/**
 * Textes UX orientés "promesse produit" (rapidité, clarté, adapté métier).
 * Usage: pages Products, Inventory, Dashboard, etc.
 */
export function getUxCopy(serviceType, domain) {
  const isGeneral = domain === "general";

  switch (serviceType) {
    case "pharmacy_parapharmacy":
      return {
        // Titles / intros
        productsTitle: "Gestion des produits santé",
        productsIntro:
          "Ajoutez vos produits avec CIP/Code-barres ou code interne. Stock mensuel clair, fiable et exportable.",
        inventoryTitle: "Inventaire pharmacie / parapharmacie",
        inventoryIntro:
          "Saisie rapide par CIP, suivi mensuel, export pour contrôle et pilotage.",

        // UI labels / hints
        quickAddTitle: "Ajout rapide / Scan CIP",
        scanButton: "Chercher / préremplir",
        scanHint:
          "Scannez un CIP pour retrouver un produit déjà saisi et gagner du temps.",
        searchHint: "Nom, CIP ou code interne",

        // Empty states
        emptyProducts: "Aucun produit santé enregistré pour ce mois sur ce service.",
        emptyInventoryTitle: "Inventaire vide",
        emptyInventoryText:
          "Ajoutez un produit santé pour ce mois. Conseil : CIP ou code interne pour éviter les doublons.",

        // Helpers (form)
        barcodeHelper:
          "CIP recommandé : évite les doublons et facilite la recherche.",
        skuHelper:
          "Code interne utile si le CIP n’est pas disponible (ex. parapharmacie / accessoires).",
        categoryHelper: "Ex. Dermocosmétique, Hygiène, Compléments…",
      };

    case "bar":
      return {
        productsTitle: "Gestion des références bar",
        productsIntro:
          "Ajoutez rapidement vos bouteilles, fûts et boissons. Suivi simple et exploitable.",
        inventoryTitle: "Inventaire bar",
        inventoryIntro:
          "Pensé pour les bouteilles et références : rapide, clair et exploitable.",

        quickAddTitle: "Ajout rapide / Scan",
        scanButton: "Chercher / préremplir",
        scanHint:
          "Scannez si possible. Sinon, utilisez un SKU bar stable pour standardiser vos références.",
        searchHint: "Nom, code-barres ou SKU bar",

        emptyProducts: "Aucune référence bar pour ce mois sur ce service.",
        emptyInventoryTitle: "Inventaire vide",
        emptyInventoryText:
          "Ajoutez une référence bar pour ce mois. Astuce : suivez les produits entamés si activé.",

        barcodeHelper:
          "Optionnel : utile pour certaines bouteilles/produits packagés.",
        skuHelper:
          "SKU bar recommandé : vous gardez un catalogue propre et stable.",
        categoryHelper: "Ex. Spiritueux, Bières, Softs…",
      };

    case "bakery":
      return {
        productsTitle: "Gestion des produits boulangerie",
        productsIntro:
          "Ajoutez pains, viennoiseries, pâtisseries et ingrédients. DLC utile pour les produits sensibles.",
        inventoryTitle: "Inventaire boulangerie",
        inventoryIntro:
          "Produits, ingrédients et stocks du mois. Objectif : rapidité + fiabilité.",

        quickAddTitle: "Ajout rapide",
        scanButton: "Chercher / préremplir",
        scanHint:
          "Scannez les ingrédients emballés. Pour le fait maison, préférez un SKU.",
        searchHint: "Nom, code-barres ou SKU",

        emptyProducts: "Aucun produit boulangerie pour ce mois sur ce service.",
        emptyInventoryTitle: "Inventaire vide",
        emptyInventoryText:
          "Ajoutez un produit boulangerie pour ce mois : ingrédients ou production.",

        barcodeHelper:
          "Optionnel : utile pour ingrédients emballés (farine, beurre, etc.).",
        skuHelper:
          "Recommandé : SKU pour vos produits maison + ingrédients récurrents.",
        categoryHelper: "Ex. Pains, Viennoiseries, Pâtisseries, Ingrédients…",
      };

    case "kitchen":
      return {
        productsTitle: "Gestion des produits cuisine",
        productsIntro:
          "Ajoutez vos matières premières. Pensé pour un inventaire rapide : quantités, unités, DLC si besoin.",
        inventoryTitle: "Inventaire cuisine",
        inventoryIntro:
          "Matières premières suivies au mois. Rapide, simple, sans friction.",

        quickAddTitle: "Ajout rapide",
        scanButton: "Chercher / préremplir",
        scanHint:
          "Scan optionnel. Pour la cuisine, un SKU peut suffire pour standardiser vos matières.",
        searchHint: "Nom, code-barres ou SKU",

        emptyProducts: "Aucun produit cuisine pour ce mois sur ce service.",
        emptyInventoryTitle: "Inventaire vide",
        emptyInventoryText:
          "Ajoutez une matière première pour ce mois (viandes, légumes, épicerie…).",

        barcodeHelper: "Optionnel : utile pour produits emballés.",
        skuHelper: "Optionnel : pratique pour garder un catalogue propre.",
        categoryHelper: "Ex. Viandes, Légumes, Épicerie, Surgelés…",
      };

    case "grocery_food":
    case "bulk_food":
      return {
        productsTitle:
          serviceType === "bulk_food" ? "Gestion des produits vrac" : "Gestion des produits alimentaires",
        productsIntro:
          "Ajoutez vos produits avec scan si possible. DLC recommandée pour limiter les pertes et garder un inventaire fiable.",
        inventoryTitle:
          serviceType === "bulk_food" ? "Inventaire vrac" : "Inventaire alimentaire",
        inventoryIntro:
          "Inventaire du mois avec scan, DLC et unités adaptées. Objectif : fiabilité + vitesse.",

        quickAddTitle: "Ajout rapide / Scan",
        scanButton: "Chercher / préremplir",
        scanHint:
          "Scannez pour gagner du temps et éviter les doublons. Sinon, utilisez un SKU stable.",
        searchHint: "Nom, code-barres ou SKU",

        emptyProducts:
          serviceType === "bulk_food"
            ? "Aucun produit vrac pour ce mois sur ce service."
            : "Aucun produit alimentaire pour ce mois sur ce service.",
        emptyInventoryTitle: "Inventaire vide",
        emptyInventoryText:
          "Ajoutez un produit pour ce mois. Conseil : EAN/SKU recommandé pour éviter les doublons.",

        barcodeHelper:
          "Recommandé : scan = moins d’erreurs et moins de doublons.",
        skuHelper:
          "Recommandé si vous n’avez pas toujours d’EAN sur vos produits.",
        categoryHelper: "Ex. Boissons, Frais, Épicerie, Vrac…",
      };

    case "retail_general":
      return {
        productsTitle: "Gestion des articles boutique",
        productsIntro:
          "Ajoutez vos articles avec SKU / référence. Code-barres optionnel selon vos besoins.",
        inventoryTitle: "Inventaire boutique",
        inventoryIntro:
          "Suivi mensuel simple : SKU, catégories et quantités. Scan optionnel.",

        quickAddTitle: "Ajout rapide",
        scanButton: "Chercher / préremplir",
        scanHint:
          "Pour une boutique, le SKU est votre identifiant principal. Le code-barres peut rester optionnel.",
        searchHint: "Nom, code-barres ou SKU",

        emptyProducts: "Aucun article boutique pour ce mois sur ce service.",
        emptyInventoryTitle: "Inventaire vide",
        emptyInventoryText:
          "Ajoutez un article pour ce mois. SKU recommandé pour éviter les doublons.",

        barcodeHelper:
          "Optionnel : utile si vous scannez à la réception ou en caisse.",
        skuHelper:
          "Recommandé : SKU = base stable pour gérer vos articles.",
        categoryHelper: "Ex. Vêtements, Accessoires, Bijoux…",
      };

    default:
      if (isGeneral) {
        return {
          productsTitle: "Gestion des articles",
          productsIntro:
            "Ajoutez vos articles et suivez votre stock par mois. Scan optionnel, SKU recommandé.",
          inventoryTitle: "Inventaire",
          inventoryIntro:
            "Suivi du mois : articles, quantités, catégories et identifiants.",

          quickAddTitle: "Ajout rapide",
          scanButton: "Chercher / préremplir",
          scanHint: "Scan optionnel, SKU recommandé.",
          searchHint: "Nom, code-barres ou SKU",

          emptyProducts: "Aucun article pour ce mois sur ce service.",
          emptyInventoryTitle: "Inventaire vide",
          emptyInventoryText: "Ajoutez un article pour ce mois.",

          barcodeHelper: "Optionnel.",
          skuHelper: "Recommandé : identifiant interne stable.",
          categoryHelper: "Ex. Catégorie 1, Catégorie 2…",
        };
      }
      return {
        productsTitle: "Gestion des produits",
        productsIntro:
          "Ajoutez vos produits et suivez votre stock par mois. Adapté à votre métier et exportable.",
        inventoryTitle: "Inventaire",
        inventoryIntro:
          "Suivi mensuel adapté à votre activité. Simple, rapide, exportable.",

        quickAddTitle: "Ajout rapide / Scan",
        scanButton: "Chercher / préremplir",
        scanHint: "Scan recommandé si vous l’utilisez au quotidien.",
        searchHint: "Nom, code-barres ou SKU",

        emptyProducts: "Aucun produit pour ce mois sur ce service.",
        emptyInventoryTitle: "Inventaire vide",
        emptyInventoryText: "Ajoutez un produit pour ce mois.",

        barcodeHelper: "Recommandé si vous scannez.",
        skuHelper: "Recommandé si vous n’avez pas toujours d’EAN.",
        categoryHelper: "Ex. Boissons, Frais, Réserve…",
      };
  }
}

/**
 * Placeholders contextualisés par métier.
 * Usage: forms Products/Inventory + quick add + etc.
 */
export function getPlaceholders(serviceType, domain) {
  const isGeneral = domain === "general";

  if (serviceType === "pharmacy_parapharmacy") {
    return {
      name: "Ex. Doliprane 1g",
      category: "Ex. Antalgique / Hygiène",
      sku: "Ex. SKU-PHA-001",
    };
  }

  if (serviceType === "bar") {
    return {
      name: "Ex. Gin 70cl",
      category: "Ex. Spiritueux / Bières",
      sku: "Ex. SKU-BAR-GIN-001",
    };
  }

  if (serviceType === "bakery") {
    return {
      name: "Ex. Farine T55 25kg",
      category: "Ex. Ingrédients / Viennoiseries",
      sku: "Ex. SKU-BAK-001",
    };
  }

  if (serviceType === "kitchen") {
    return {
      name: "Ex. Filet de poulet",
      category: "Ex. Viandes / Légumes",
      sku: "Ex. SKU-KIT-001",
    };
  }

  if (serviceType === "grocery_food" || serviceType === "bulk_food") {
    return {
      name: "Ex. Coca 33cl",
      category: serviceType === "bulk_food" ? "Ex. Vrac / Épicerie" : "Ex. Boissons / Frais",
      sku: serviceType === "bulk_food" ? "Ex. SKU-VRAC-001" : "Ex. SKU-FOOD-001",
    };
  }

  if (serviceType === "retail_general" || isGeneral) {
    return {
      name: "Ex. T-shirt coton",
      category: "Ex. Vêtements / Bijoux",
      sku: "Ex. SKU-TSH-001",
    };
  }

  return {
    name: "Ex. Produit A",
    category: "Ex. Catégorie A",
    sku: "Ex. SKU-001",
  };
}

/**
 * Helpers optionnels centralisés (si besoin d'harmoniser les messages)
 * Exemple: getFieldHelpers(...).barcode, etc.
 */
export function getFieldHelpers(serviceType, domain) {
  const ux = getUxCopy(serviceType, domain);
  return {
    barcode: ux.barcodeHelper,
    sku: ux.skuHelper,
    category: ux.categoryHelper,
  };
}