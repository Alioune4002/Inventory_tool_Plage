import { api } from "./api";

const TRACK_TTL_MS = 10 * 60 * 1000;

function shouldSkip(page) {
  try {
    const key = `track_visit_${page}`;
    const sessionLast = Number(sessionStorage.getItem(key) || "0");
    if (Date.now() - sessionLast < TRACK_TTL_MS) return true;
    sessionStorage.setItem(key, String(Date.now()));

    const last = Number(localStorage.getItem(key) || "0");
    if (Date.now() - last < TRACK_TTL_MS) return true;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // ignore storage errors
  }
  return false;
}

export function trackPublicVisit(page) {
  if (!page || shouldSkip(page)) return;
  api
    .post("/api/admin/track-visit/", { page }, { skipServiceContext: true })
    .catch(() => {});
}
