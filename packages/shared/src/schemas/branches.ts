import { z } from 'zod';

// GET /branches (spec 005): active branches of the tenant, for selectors and
// the internal map. Coordinates are serialized as strings (Prisma Decimal).
export const branchSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string().nullable(),
  latitude: z.string().nullable(),
  longitude: z.string().nullable(),
});
export type BranchSummary = z.infer<typeof branchSummarySchema>;

export const listBranchesResponseSchema = z.array(branchSummarySchema);
export type ListBranchesResponse = z.infer<typeof listBranchesResponseSchema>;
