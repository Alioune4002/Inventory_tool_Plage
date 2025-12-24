
import { FAMILLES, resolveFamilyId } from "./famillesConfig";

const FALLBACK_FAMILY = FAMILLES[0];

const getFamily = (serviceType, domain) => {
  const familyId = resolveFamilyId(serviceType, domain);
  return FAMILLES.find((famille) => famille.id === familyId) || FALLBACK_FAMILY;
};

const getFeatureEnabled = (features, key, fallback = false) => {
  const cfg = features?.[key];
  if (cfg && typeof cfg.enabled === "boolean") {
    return cfg.enabled;
  }
  return fallback;
};

const getIdentifierLabel = (familyId, identifiers) => {
  const barcodeLabel = familyId === "pharmacie" ? "CIP" : "code-barres";
  if (identifiers?.barcode && identifiers?.sku) {
    return `${barcodeLabel} ou SKU`;
  }
  if (identifiers?.barcode) {
    return barcodeLabel;
  }
  return "SKU";
};

export function getWording(serviceType, domain) {
  const family = getFamily(serviceType, domain);
  const identifierLabel = getIdentifierLabel(family.id, family.identifiers);
  return {
    itemLabel: family.labels.itemLabel,
    itemPlural: family.labels.itemPlural,
    categoryLabel: family.labels.categoryLabel,
    skuLabel: family.labels.skuLabel,
    barcodeLabel: family.labels.barcodeLabel,
    identifierLabel,
  };
}

/**
 * Textes UX orientes "promesse produit" (rapidite, clarte, adapte metier).
 * Usage: pages Products, Inventory, Dashboard, etc.
 */
export function getUxCopy(serviceType, domain) {
  const family = getFamily(serviceType, domain);
  const familyId = family.id;
  const itemLabel = family.labels.itemLabel.toLowerCase();
  const itemPlural = family.labels.itemPlural.toLowerCase();
  const categoryLabel = family.labels.categoryLabel.toLowerCase();
  const identifierLabel = getIdentifierLabel(familyId, family.identifiers);
  const hasBarcode = Boolean(family.identifiers?.barcode);
  const hasSku = Boolean(family.identifiers?.sku);
  const hasItemType = family.modules?.includes("itemType");

  const base = {
    productsTitle: `Catalogue ${itemPlural}`,
    productsIntro: `Votre referentiel ${itemPlural} : identifiants clairs, sans quantites.`,
    catalogueNote: "Catalogue = referentiel. Les quantites et pertes se font dans Inventaire.",
    inventoryTitle: `Inventaire ${family.name.toLowerCase()}`,
    inventoryIntro: `Comptage du mois par ${itemPlural} avec ${identifierLabel}.`,
    quickAddTitle: hasBarcode ? "Ajout rapide / Scan" : "Ajout rapide",
    scanButton: "Chercher / pre-remplir",
    scanHint: hasBarcode
      ? "Scannez pour gagner du temps et eviter les doublons. Sinon, utilisez un SKU stable."
      : "Le SKU est l'identifiant principal. Le scan reste optionnel.",
    searchHint: `Nom, ${identifierLabel}`,
    emptyProducts: `Aucun ${itemLabel} pour ce mois sur ce service.`,
    emptyInventoryTitle: "Inventaire vide",
    emptyInventoryText: `Ajoutez un ${itemLabel} pour ce mois pour demarrer le comptage.`,
    barcodeHelper: hasBarcode
      ? "Recommande : scan pour eviter les doublons."
      : "Optionnel si vous avez deja un SKU.",
    skuHelper: hasSku
      ? "SKU interne recommande pour garder un catalogue propre."
      : "SKU optionnel selon vos usages.",
    categoryHelper: family.placeholders?.category || `Ex. ${categoryLabel}`,
  };

  switch (familyId) {
    case "pharmacie":
      return {
        ...base,
        productsTitle: "Catalogue sante",
        productsIntro:
          "Votre referentiel sante : CIP/Code-barres ou code interne, sans quantites.",
        inventoryTitle: "Inventaire pharmacie & parapharmacie",
        inventoryIntro:
          "Comptage mensuel par CIP pour rester conforme et gagner du temps.",
        quickAddTitle: "Ajout rapide / Scan CIP",
        scanHint:
          "Scannez un CIP pour retrouver un produit deja saisi et gagner du temps.",
        searchHint: "Nom, CIP ou code interne",
        barcodeHelper: "CIP recommande : evite les doublons et facilite la recherche.",
        skuHelper:
          "Code interne utile si le CIP n'est pas disponible (parapharmacie, accessoires).",
      };

    case "bar":
      return {
        ...base,
        productsTitle: "Catalogue bar & boissons",
        productsIntro:
          "Referentiel bar : bouteilles, fûts, softs. Aucun stock ici.",
        inventoryTitle: "Inventaire bar",
        inventoryIntro:
          "Comptage mensuel des references bar pour un suivi rapide et fiable.",
        emptyInventoryText:
          "Ajoutez une reference bar pour ce mois. Astuce : suivez les contenants entames si active.",
        categoryHelper: "Ex. Spiritueux, Bieres, Softs",
      };

    case "restauration":
      return {
        ...base,
        productsTitle: "Catalogue restauration",
        productsIntro:
          "Referentiel matieres premieres et produits finis. Aucun stock ici.",
        inventoryTitle: "Inventaire restauration",
        inventoryIntro:
          "Comptage mensuel pour cuisine et salle. Simple, clair, exportable.",
        scanHint:
          "Scan optionnel. Un SKU peut suffire pour standardiser vos matieres premieres.",
        categoryHelper: "Ex. Cuisine, Salle, Prepa froide",
        productRoleHelper: hasItemType
          ? "Matiere premiere = cout. Produit fini = vente. Utile pour marge estimee."
          : undefined,
      };

    case "boulangerie":
      return {
        ...base,
        productsTitle: "Catalogue boulangerie & patisserie",
        productsIntro:
          "Referentiel pains, viennoiseries et ingredients. Pas de stock ici.",
        inventoryTitle: "Inventaire boulangerie",
        inventoryIntro:
          "Comptage du mois pour pains, patisseries et ingredients maison.",
        scanHint:
          "Scannez les ingredients emballes. Pour le fait maison, preferez un SKU.",
        categoryHelper: "Ex. Pains, Viennoiseries, Patisseries",
        productRoleHelper: hasItemType
          ? "Definissez matiere premiere ou produit fini pour une lecture marge plus claire."
          : undefined,
      };

    case "mode":
      return {
        ...base,
        productsTitle: "Catalogue mode & accessoires",
        productsIntro:
          "Referentiel mode : SKU, collections, variantes. Pas de stock ici.",
        inventoryTitle: "Inventaire mode",
        inventoryIntro:
          "Comptage mensuel propre : SKU, collections et quantites. Scan optionnel.",
        scanHint:
          "Le SKU reste votre identifiant principal. Le code-barres reste optionnel.",
        barcodeHelper: "Optionnel : utile si vous scannez en caisse ou en reception.",
        skuHelper: "SKU recommande : base stable pour gerer vos collections.",
        categoryHelper: "Ex. Collection ete, Accessoires, Bijoux",
      };

    case "retail":
      return {
        ...base,
        productsTitle: "Catalogue retail alimentaire",
        productsIntro:
          "Referentiel epicerie : code-barres recommande, sans stock ici.",
        inventoryTitle: "Inventaire retail alimentaire",
        inventoryIntro:
          "Comptage mensuel des rayons avec DLC/DDM si active.",
        scanHint:
          "Scannez pour eviter les doublons. Sinon, utilisez un SKU interne stable.",
        categoryHelper: "Ex. Frais, Epicerie, Boissons, Surgeles",
      };

    default:
      return base;
  }
}

/**
 * Placeholders contextualises par metier.
 * Usage: forms Products/Inventory + quick add + etc.
 */
export function getPlaceholders(serviceType, domain) {
  const family = getFamily(serviceType, domain);
  return (
    family.placeholders || {
      name: "Ex. Produit A",
      category: "Ex. Categorie A",
      sku: "Ex. SKU-001",
      brand: "Ex. Marque A",
      supplier: "Ex. Fournisseur A",
      notes: "Ex. Infos internes",
    }
  );
}

/**
 * Helpers optionnels centralises (si besoin d'harmoniser les messages)
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

export function getLossReasons(serviceType, domain, features) {
  const family = getFamily(serviceType, domain);
  const expiryEnabled = getFeatureEnabled(features, "dlc", family.modules?.includes("expiry"));
  const reasons = [
    { value: "breakage", label: "Casse" },
    { value: "expired", label: "DLC / DDM depassee" },
    { value: "theft", label: "Vol" },
    { value: "free", label: "Offert" },
    { value: "mistake", label: "Erreur" },
    { value: "other", label: "Autre" },
  ];

  if (!expiryEnabled) {
    return reasons.filter((r) => r.value !== "expired");
  }
  return reasons;
}
