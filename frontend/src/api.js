import axios from 'axios';

function resolveApiBaseUrl() {
  const explicit = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (explicit && explicit !== '/api/v1/') return explicit;
  const host = (import.meta.env.VITE_API_HOST || '').trim();
  if (host) {
    const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const proto = cleanHost.includes('localhost') || cleanHost.includes('127.0.0.1') ? 'http' : 'https';
    return `${proto}://${cleanHost}/api/v1/`;
  }
  return explicit || '/api/v1/';
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 55000,
});

const key = 'krishisetu_session';
export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}
export function setSession(session) {
  sessionStorage.setItem(key, JSON.stringify(session));
}
export function dropSession() {
  sessionStorage.removeItem(key);
}

// Memory Cache & In-Flight Request Deduplication
const memoryCache = new Map();
const inFlightRequests = new Map();
const CACHEABLE_ENDPOINTS = ['crops/', 'markets/'];
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// 429 Rate Limit Cooldown Tracker
let throttledUntil = 0;
let throttleMessage = '';

export function getThrottledCooldown() {
  const remainingMs = throttledUntil - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

export function invalidateCache(endpoint = '') {
  if (!endpoint) {
    memoryCache.clear();
  } else {
    for (const k of memoryCache.keys()) {
      if (k.includes(endpoint)) memoryCache.delete(k);
    }
  }
}

// Request Interceptor
api.interceptors.request.use((config) => {
  const session = getSession();
  if (session?.access && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${session.access}`;
  }

  // Early exit if currently throttled
  const cooldownSec = getThrottledCooldown();
  if (cooldownSec > 0 && config.method?.toLowerCase() === 'get') {
    const error = new Error(throttleMessage || `Request was throttled. Expected available in ${cooldownSec} seconds.`);
    error.response = {
      status: 429,
      data: { detail: throttleMessage || `Request was throttled. Expected available in ${cooldownSec} seconds.` },
      headers: { 'retry-after': String(cooldownSec) },
    };
    return Promise.reject(error);
  }

  return config;
});

// Response Interceptor
let refreshing;
api.interceptors.response.use(
  (response) => {
    // If successful response and endpoint is cacheable, store in memory cache
    const url = response.config?.url || '';
    if (response.config?.method?.toLowerCase() === 'get' && CACHEABLE_ENDPOINTS.some((ep) => url.endsWith(ep) || url.includes(ep))) {
      const cacheKey = `${url}?${JSON.stringify(response.config?.params || {})}`;
      memoryCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    }
    return response;
  },
  async (error) => {
    const original = error.config;

    // Handle 429 Throttled & Respect Retry-After
    if (error.response?.status === 429) {
      let waitSeconds = 0;
      const retryAfterHeader = error.response.headers?.['retry-after'];
      if (retryAfterHeader && !isNaN(Number(retryAfterHeader))) {
        waitSeconds = parseInt(retryAfterHeader, 10);
      } else {
        const detail = error.response.data?.detail || '';
        const match = detail.match(/(\d+)\s*seconds/i);
        if (match) {
          waitSeconds = parseInt(match[1], 10);
        } else {
          waitSeconds = 30; // fallback default
        }
      }
      throttledUntil = Date.now() + waitSeconds * 1000;
      throttleMessage = error.response.data?.detail || `Request was throttled. Expected available in ${waitSeconds} seconds.`;
    }

    // Handle 401 Session Refresh
    if (
      error.response?.status === 401 &&
      !original?._retry &&
      getSession()?.refresh &&
      !['auth/refresh/', 'auth/login/', 'auth/google/', 'auth/register/'].some((p) => original.url?.includes(p))
    ) {
      original._retry = true;
      try {
        refreshing ||= axios
          .post(`${api.defaults.baseURL}auth/refresh/`, { refresh: getSession().refresh })
          .then((r) => {
            const updated = {
              ...getSession(),
              access: r.data.access,
              refresh: r.data.refresh || getSession().refresh,
            };
            setSession(updated);
            return updated;
          })
          .finally(() => {
            refreshing = null;
          });
        const next = await refreshing;
        original.headers.Authorization = `Bearer ${next.access}`;
        return api(original);
      } catch {
        dropSession();
        window.dispatchEvent(new Event('krishisetu-session-expired'));
      }
    }
    return Promise.reject(error);
  }
);

// Wrapped GET with in-flight deduplication and memory cache lookup
const originalGet = api.get.bind(api);
api.get = function (url, config = {}) {
  const isCacheable = CACHEABLE_ENDPOINTS.some((ep) => url.endsWith(ep) || url.includes(ep));
  const cacheKey = `${url}?${JSON.stringify(config?.params || {})}`;

  // Check cache first
  if (isCacheable && memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return Promise.resolve({ data: cached.data, status: 200, statusText: 'OK', config, headers: {} });
    } else {
      memoryCache.delete(cacheKey);
    }
  }

  // Deduplicate in-flight identical requests
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const reqPromise = originalGet(url, config)
    .then((res) => {
      if (isCacheable) {
        memoryCache.set(cacheKey, { data: res.data, timestamp: Date.now() });
      }
      return res;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, reqPromise);
  return reqPromise;
};

export function errorMessage(error) {
  const data = error?.response?.data;
  if (typeof data === 'string') return data;
  if (data?.detail) return data.detail;
  if (data && typeof data === 'object') {
    return Object.entries(data)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' · ');
  }
  return error?.message || 'Request failed';
}

export function entries(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.data?.results)) return response.data.results;
  return [];
}
