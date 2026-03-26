type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inFlightStore = new Map<string, Promise<unknown>>();

export const serverCacheNamespaces = {
  activity: "pa:activity",
  report: "pa:report",
  reportSummary: "pa:report-summary",
  timeAttendance: "pa:time-attendance",
} as const;

const paReadCachePrefixes = Object.values(serverCacheNamespaces).map((namespace) => `${namespace}:`);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(",")}}`;
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function purgeExpired(now = Date.now()) {
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expiresAt <= now) {
      cacheStore.delete(key);
      inFlightStore.delete(key);
    }
  }
}

export function buildServerCacheKey(namespace: string, payload: unknown): string {
  return `${namespace}:${stableStringify(payload)}`;
}

export async function getOrSetServerCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  if (ttlMs <= 0) {
    return loader();
  }

  const now = Date.now();
  purgeExpired(now);

  const existing = cacheStore.get(key);
  if (existing && existing.expiresAt > now) {
    return cloneValue(existing.value as T);
  }

  const inFlight = inFlightStore.get(key);
  if (inFlight) {
    return cloneValue((await inFlight) as T);
  }

  const loadPromise = (async () => {
    const value = await loader();
    cacheStore.set(key, {
      expiresAt: Date.now() + ttlMs,
      value,
    });
    return value;
  })();

  inFlightStore.set(key, loadPromise);

  try {
    return cloneValue((await loadPromise) as T);
  } finally {
    inFlightStore.delete(key);
  }
}

export function invalidateServerCache(prefixes: string | string[]) {
  purgeExpired();
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  for (const prefix of list) {
    for (const key of cacheStore.keys()) {
      if (key.startsWith(prefix)) {
        cacheStore.delete(key);
      }
    }
    for (const key of inFlightStore.keys()) {
      if (key.startsWith(prefix)) {
        inFlightStore.delete(key);
      }
    }
  }
}

export function invalidatePaReadCaches() {
  invalidateServerCache(paReadCachePrefixes);
}
