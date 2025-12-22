export const TOUR_KEY_PREFIX = "stockscan_tour_v1";
export const TOUR_PENDING_PREFIX = "stockscan_tour_pending_v1";

export function getTourKey(userId) {
  return userId ? `${TOUR_KEY_PREFIX}:${userId}` : TOUR_KEY_PREFIX;
}

export function getTourPendingKey(userId) {
  return userId ? `${TOUR_PENDING_PREFIX}:${userId}` : TOUR_PENDING_PREFIX;
}
