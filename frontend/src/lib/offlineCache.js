const PREFIX = "offline_cache_v1";

export function saveOfflineCache(key, value) {
  try {
    const payload = { at: Date.now(), value };
    localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(payload));
  } catch {
    // noop
  }
}

export function loadOfflineCache(key) {
  try {
    const raw = localStorage.getItem(`${PREFIX}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.value ?? null;
  } catch {
    return null;
  }
}
