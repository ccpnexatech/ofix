import type { AccessTokenPayload } from '@ofix/shared';

/** Shape of `request.user`, derived from the access token claims (spec 003). */
export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  branchId: string | null;
  role: AccessTokenPayload['role'];
  name: string;
}

export interface AuthenticatedRequest {
  user?: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  cookies?: Record<string, string>;
}
