import { API_PREFIX } from '@ofix/shared';

/**
 * API client (spec 003): access token lives in memory only — never in
 * localStorage. On 401 it tries ONE rotating refresh (httpOnly cookie,
 * same-origin via Next rewrite) and replays the request once.
 */

let accessToken: string | undefined;
let onSessionLost: (() => void) | undefined;

export function setAccessToken(token: string | undefined): void {
  accessToken = token;
}

export function getAccessToken(): string | undefined {
  return accessToken;
}

/** The auth provider registers the redirect-to-login behavior here. */
export function setOnSessionLost(handler: () => void): void {
  onSessionLost = handler;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  message?: string;
  details?: unknown;
}

async function rawRequest(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken !== undefined) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`/${API_PREFIX}${path}`, { ...init, headers, credentials: 'include' });
}

/** Refresh + retry once on 401 (spec 003 interceptor). */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await rawRequest(path, init);

  if (response.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await tryRefresh();
    if (!refreshed) {
      onSessionLost?.();
      throw new ApiError(401, 'Sessão expirada');
    }
    response = await rawRequest(path, init);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    throw new ApiError(response.status, body.message ?? 'Erro inesperado', body.details);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function tryRefresh(): Promise<boolean> {
  const response = await fetch(`/${API_PREFIX}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    return false;
  }
  const body = (await response.json()) as { accessToken: string };
  accessToken = body.accessToken;
  return true;
}
