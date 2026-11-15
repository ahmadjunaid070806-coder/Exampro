const SESSION_KEY = 'exampro_session_v1';
const VISITOR_KEY = 'exampro_visitor_id';

export interface StoredSession {
  userId: number;
  sessionToken: string | null;
}

export function getStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(session: StoredSession | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore storage errors
  }
}

export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = `v-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return 'v-anon';
  }
}

const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export function resolveApiUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalized = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return RAW_API_BASE ? `${RAW_API_BASE}${normalized}` : normalized;
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const session = getStoredSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-visitor-id': getVisitorId(),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (session) {
    headers['x-user-id'] = String(session.userId);
    if (session.sessionToken) {
      headers['x-session-token'] = session.sessionToken;
    }
  }

  const useDefaultTimeout = !options.signal;
  const controller = useDefaultTimeout ? new AbortController() : null;
  const timer = controller ? window.setTimeout(() => controller.abort(), 15000) : null;

  try {
    const res = await fetch(resolveApiUrl(url), {
      ...options,
      headers,
      signal: options.signal ?? controller?.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data as T;
  } catch (err: unknown) {
    if (useDefaultTimeout && err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw err;
  } finally {
    if (timer !== null) window.clearTimeout(timer);
  }
}
