export const KDS_ELIGIBLE_SERVICE_TYPES = new Set([
  "kitchen",
  "restaurant_dining",
  "bar",
  "bakery",
]);

export function isKdsEligible(serviceType) {
  return KDS_ELIGIBLE_SERVICE_TYPES.has(String(serviceType || ""));
}

export function isKdsEnabled(serviceProfile) {
  if (!serviceProfile) return false;
  const serviceType = serviceProfile?.service_type;
  const features = serviceProfile?.features || {};
  return isKdsEligible(serviceType) && features.kds?.enabled === true;
}
