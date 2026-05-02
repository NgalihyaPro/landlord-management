import axios from 'axios';

const isProduction = import.meta.env.PROD;
const configuredApiUrl = import.meta.env.VITE_API_URL;

const getDefaultApiUrl = () => {
  if (configuredApiUrl) {
    return configuredApiUrl.replace(/\/+$/, '');
  }

  if (isProduction) {
    return '/api';
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5001/api`;
  }

  return 'http://localhost:3000/api';
};

export const API_URL = getDefaultApiUrl();

type CacheEntry<T = unknown> = {
  data?: T;
  expiresAt: number;
  promise?: Promise<T>;
};

const GET_CACHE = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL_MS = 30_000;
let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const isUnsafeMethod = (method?: string) => {
  const normalizedMethod = (method || 'get').toLowerCase();
  return ['post', 'put', 'patch', 'delete'].includes(normalizedMethod);
};

async function fetchCsrfToken(force = false) {
  if (!force && csrfToken) {
    return csrfToken;
  }

  if (!force && csrfTokenPromise) {
    return csrfTokenPromise;
  }

  csrfTokenPromise = axios
    .get<{ csrf_token: string }>(`${API_URL}/auth/csrf-token`, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then((response) => {
      csrfToken = response.data.csrf_token;
      return csrfToken;
    })
    .finally(() => {
      csrfTokenPromise = null;
    });

  return csrfTokenPromise;
}

const getCacheKey = (url: string) => (url.startsWith('/') ? url : `/${url}`);

export async function cachedGet<T>(
  url: string,
  options: { ttlMs?: number; force?: boolean } = {}
): Promise<T> {
  const key = getCacheKey(url);
  const ttlMs = options.ttlMs ?? DEFAULT_CACHE_TTL_MS;
  const existing = GET_CACHE.get(key) as CacheEntry<T> | undefined;

  if (!options.force && existing?.data !== undefined && existing.expiresAt > Date.now()) {
    return existing.data;
  }

  if (!options.force && existing?.promise) {
    return existing.promise;
  }

  const promise = api.get<T>(key).then((response) => {
    GET_CACHE.set(key, {
      data: response.data,
      expiresAt: Date.now() + ttlMs,
    });
    return response.data;
  }).catch((error) => {
    GET_CACHE.delete(key);
    throw error;
  });

  GET_CACHE.set(key, {
    data: existing?.data,
    expiresAt: existing?.expiresAt ?? 0,
    promise,
  });

  return promise;
}

export function prefetchGet(url: string, options?: { ttlMs?: number }) {
  if (typeof window === 'undefined') return;

  void cachedGet(url, options).catch(() => {
    // Ignore warm-up failures and let the page request handle the error.
  });
}

export function invalidateGetCache(
  matcher?: string | RegExp | ((key: string) => boolean)
) {
  if (!matcher) {
    GET_CACHE.clear();
    return;
  }

  Array.from(GET_CACHE.keys()).forEach((key) => {
    const matches =
      typeof matcher === 'string'
        ? key.startsWith(matcher)
        : matcher instanceof RegExp
          ? matcher.test(key)
          : matcher(key);

    if (matches) {
      GET_CACHE.delete(key);
    }
  });
}

export function clearGetCache() {
  GET_CACHE.clear();
}

export function clearCsrfToken() {
  csrfToken = null;
  csrfTokenPromise = null;
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong.') {
  if (axios.isAxiosError(error)) {
    return (
      (typeof error.response?.data?.error === 'string' && error.response.data.error) ||
      (typeof error.response?.data?.message === 'string' && error.response.data.message) ||
      fallback
    );
  }

  return fallback;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestConfig = (error.config || {}) as typeof error.config & {
      _csrfRetried?: boolean;
      headers?: Record<string, string>;
    };
    const requestUrl = String(requestConfig.url || '');

    if (
      error.response?.status === 403 &&
      error.response?.data?.error === 'Invalid CSRF token.' &&
      isUnsafeMethod(requestConfig.method) &&
      !requestConfig._csrfRetried
    ) {
      requestConfig._csrfRetried = true;
      return fetchCsrfToken(true).then((token) => {
        const headers = axios.AxiosHeaders.from(requestConfig.headers || {});
        headers.set('X-CSRF-Token', token);
        requestConfig.headers = headers;
        return api(requestConfig);
      });
    }

    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const isAuthEndpoint =
        requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/register') ||
        requestUrl.includes('/auth/forgot-password') ||
        requestUrl.includes('/auth/reset-password') ||
        requestUrl.includes('/auth/setup-account') ||
        requestUrl.includes('/auth/me');
      const isPublicPage =
        currentPath === '/login' ||
        currentPath === '/forgot-password' ||
        currentPath === '/register' ||
        currentPath.startsWith('/reset-password') ||
        currentPath.startsWith('/setup-account');

      if (!isAuthEndpoint && !isPublicPage) {
        clearGetCache();
        clearCsrfToken();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

api.interceptors.request.use(async (config) => {
  const requestUrl = String(config.url || '');

  if (isUnsafeMethod(config.method) && !requestUrl.includes('/auth/csrf-token')) {
    const token = await fetchCsrfToken();
    const headers = axios.AxiosHeaders.from(config.headers || {});
    headers.set('X-CSRF-Token', token);
    config.headers = headers;
  }

  return config;
});

export default api;
