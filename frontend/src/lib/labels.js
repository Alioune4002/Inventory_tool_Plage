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
        itemLabel: "Article mode",
        itemPlural: "Articles mode",
        categoryLabel: "Collection",
        skuLabel: "SKU / Réf.",
        barcodeLabel: "Code-barres (optionnel)",
      };

    case "bar":
      return {
        itemLabel: "Référence bar",
        itemPlural: "Références bar",
        categoryLabel: "Famille",
        skuLabel: "SKU bar",
        barcodeLabel: "Code-barres (optionnel)",
      };

    case "kitchen":
      return {
        itemLabel: "Produit cuisine",
        itemPlural: "Produits cuisine",
        categoryLabel: "Poste",
        skuLabel: "SKU interne",
        barcodeLabel: "Code-barres (optionnel)",
      };

    case "bakery":
      return {
        itemLabel: "Produit boulangerie",
        itemPlural: "Produits boulangerie",
        categoryLabel: "Fournée",
        skuLabel: "SKU boulangerie",
        barcodeLabel: "Code-barres (optionnel)",
      };

    case "grocery_food":
      return {
        itemLabel: "Produit",
        itemPlural: "Produits",
        categoryLabel: "Rayon",
        skuLabel: "SKU interne",
        barcodeLabel: "Code-barres",
      };

    case "bulk_food":
      return {
        itemLabel: "Produit vrac",
        itemPlural: "Produits vrac",
        categoryLabel: "Rayon",
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
        productsTitle: "Catalogue santé",
        productsIntro:
          "Votre référentiel produits santé : CIP/Code-barres ou code interne, sans quantités.",
        catalogueNote:
          "Catalogue = référentiel. Les quantités, pertes et péremptions se font dans Inventaire.",
        inventoryTitle: "Inventaire pharmacie / parapharmacie",
        inventoryIntro:
          "Comptage mensuel par CIP, export pour contrôle et pilotage.",

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
        productsTitle: "Catalogue bar",
        productsIntro:
          "Référentiel bar : bouteilles, fûts, softs. Aucun stock ici.",
        catalogueNote:
          "Catalogue = base des références. Le comptage se fait dans Inventaire.",
        inventoryTitle: "Inventaire bar",
        inventoryIntro:
          "Comptage mensuel pour bouteilles et références : rapide, clair et exploitable.",

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
        productsTitle: "Catalogue boulangerie",
        productsIntro:
          "Référentiel pains, viennoiseries, ingrédients. Aucun stock ici.",
        catalogueNote:
          "Catalogue = base des produits. Les quantités et pertes sont gérées dans Inventaire.",
        inventoryTitle: "Inventaire boulangerie",
        inventoryIntro:
          "Comptage du mois : produits, ingrédients, stocks. Objectif : rapidité + fiabilité.",

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
        productRoleHelper:
          "Choisissez si c’est une matière première, un produit fini ou une préparation maison.",
      };

    case "kitchen":
      return {
        productsTitle: "Catalogue cuisine",
        productsIntro:
          "Référentiel matières premières et préparations. Sans quantités.",
        catalogueNote:
          "Catalogue = liste de base. Le comptage mensuel est dans Inventaire.",
        inventoryTitle: "Inventaire cuisine",
        inventoryIntro:
          "Comptage du mois des matières premières. Rapide, simple, sans friction.",

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
        productRoleHelper:
          "Matière première = coût. Produit fini = vente. Utile pour marge estimée.",
      };

    case "grocery_food":
    case "bulk_food":
      return {
        productsTitle:
          serviceType === "bulk_food" ? "Catalogue vrac" : "Catalogue alimentaire",
        productsIntro:
          "Référentiel alimentaire : scan si possible, sans stock ici.",
        catalogueNote:
          "Catalogue = référentiel. Inventaire gère les quantités, pertes et DLC.",
        inventoryTitle:
          serviceType === "bulk_food" ? "Inventaire vrac" : "Inventaire alimentaire",
        inventoryIntro:
          "Comptage du mois avec scan, DLC et unités adaptées. Objectif : fiabilité + vitesse.",

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
        productsTitle: "Catalogue mode & accessoires",
        productsIntro:
          "Référentiel mode : SKU, collections, variantes. Pas de stock ici.",
        catalogueNote:
          "Catalogue = fiches articles. Le comptage et les pertes sont dans Inventaire.",
        inventoryTitle: "Inventaire mode",
        inventoryIntro:
          "Comptage mensuel propre : SKU, collections et quantités. Scan optionnel.",

        quickAddTitle: "Ajout rapide",
        scanButton: "Chercher / préremplir",
        scanHint:
          "Le SKU reste votre identifiant principal. Le code-barres peut rester optionnel.",
        searchHint: "Nom, SKU ou code-barres",

        emptyProducts: "Aucune pièce enregistrée pour ce mois sur ce service.",
        emptyInventoryTitle: "Inventaire vide",
        emptyInventoryText:
          "Ajoutez une pièce pour ce mois. SKU recommandé pour éviter les doublons.",

        barcodeHelper:
          "Optionnel : utile si vous scannez à la réception ou en caisse.",
        skuHelper:
          "Recommandé : SKU = base stable pour gérer vos collections.",
        categoryHelper: "Ex. Collection été, Accessoires, Bijoux…",
      };

    default:
      if (isGeneral) {
        return {
          productsTitle: "Catalogue articles",
          productsIntro:
            "Référentiel articles sans quantités. SKU recommandé.",
          catalogueNote:
            "Catalogue = base articles. Les quantités se saisissent dans Inventaire.",
          inventoryTitle: "Inventaire",
          inventoryIntro:
            "Comptage du mois : articles, quantités, catégories et identifiants.",

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
        productsTitle: "Catalogue produits",
        productsIntro:
          "Référentiel produits par métier. Aucun stock ici.",
        catalogueNote:
          "Catalogue = base produits. Le comptage se fait dans Inventaire.",
        inventoryTitle: "Inventaire",
        inventoryIntro:
          "Comptage mensuel adapté à votre activité. Simple, rapide, exportable.",

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
      brand: "Ex. Sanofi",
      supplier: "Ex. Centrale pharma",
      notes: "Ex. Nécessite suivi lot",
    };
  }

  if (serviceType === "bar") {
    return {
      name: "Ex. Gin 70cl",
      category: "Ex. Spiritueux / Bières",
      sku: "Ex. SKU-BAR-GIN-001",
      brand: "Ex. Distillerie X",
      supplier: "Ex. Grossiste boissons",
      notes: "Ex. Rotation lente",
    };
  }

  if (serviceType === "bakery") {
    return {
      name: "Ex. Farine T55 25kg",
      category: "Ex. Ingrédients / Viennoiseries",
      sku: "Ex. SKU-BAK-001",
      brand: "Ex. Moulin X",
      supplier: "Ex. Fournisseur farine",
      notes: "Ex. Allergènes: gluten",
    };
  }

  if (serviceType === "kitchen") {
    return {
      name: "Ex. Filet de poulet",
      category: "Ex. Viandes / Légumes",
      sku: "Ex. SKU-KIT-001",
      brand: "Ex. Maison",
      supplier: "Ex. Marché local",
      notes: "Ex. Prépa maison",
    };
  }

  if (serviceType === "grocery_food" || serviceType === "bulk_food") {
    return {
      name: "Ex. Coca 33cl",
      category: serviceType === "bulk_food" ? "Ex. Rayon vrac" : "Ex. Rayon frais",
      sku: serviceType === "bulk_food" ? "Ex. SKU-VRAC-001" : "Ex. SKU-FOOD-001",
      brand: "Ex. Marque X",
      supplier: "Ex. Centrale / grossiste",
      notes: "Ex. Produit saisonnier",
    };
  }

  if (serviceType === "retail_general" || isGeneral) {
    return {
      name: "Ex. T-shirt coton",
      category: "Ex. Collection été / Accessoires",
      sku: "Ex. SKU-TSH-001",
      brand: "Ex. Atelier X",
      supplier: "Ex. Grossiste mode",
      notes: "Ex. Série limitée",
    };
  }

  return {
    name: "Ex. Produit A",
    category: "Ex. Catégorie A",
    sku: "Ex. SKU-001",
    brand: "Ex. Marque A",
    supplier: "Ex. Fournisseur A",
    notes: "Ex. Infos internes",
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
    productRole: ux.productRoleHelper,
  };
}
