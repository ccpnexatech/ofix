import { z } from 'zod';

import { Role } from '../enums';

// Single source of truth for auth contracts (spec 003): the API validates
// requests with these schemas and the web reuses them in forms.

export const PASSWORD_MIN_LENGTH = 8;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `A senha deve ter no mínimo ${String(PASSWORD_MIN_LENGTH)} caracteres`);

export const loginBodySchema = z.object({
  email: z.email('E-mail inválido').toLowerCase(),
  password: passwordSchema,
  // Only required when the same e-mail exists in more than one tenant.
  tenantSlug: z.string().optional(),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const authUserSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  branchId: z.uuid().nullable(),
  name: z.string(),
  email: z.string(),
  role: z.enum(Role),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const meResponseSchema = z.object({
  user: authUserSchema,
  branch: z
    .object({
      id: z.uuid(),
      name: z.string(),
      city: z.string(),
      state: z.string(),
    })
    .nullable(),
  completedTours: z.array(z.string()),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/** Claims carried by the access token (spec 003). */
export const accessTokenPayloadSchema = z.object({
  sub: z.uuid(),
  tenantId: z.uuid(),
  branchId: z.uuid().nullable(),
  role: z.enum(Role),
  name: z.string(),
});
export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;
