export const PLAN_LABELS = {
  ESSENTIEL: "Solo",
  BOUTIQUE: "Duo",
  PRO: "Multi",
  ENTREPRISE: "Entreprise",
};

export const PLAN_ORDER = ["ESSENTIEL", "BOUTIQUE", "PRO", "ENTREPRISE"];

export function formatPlanLabel(code, fallback = "Solo") {
  const key = String(code || "").toUpperCase();
  return PLAN_LABELS[key] || fallback;
}

export function getNextPlanCode(code) {
  const key = String(code || "").toUpperCase();
  if (key === "ESSENTIEL") return "BOUTIQUE";
  if (key === "BOUTIQUE") return "PRO";
  return null;
}

export function formatUpgradeLabel(code) {
  const next = getNextPlanCode(code);
  if (!next) return null;
  return formatPlanLabel(next);
}
