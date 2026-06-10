import type { PaginationQuery } from '@ofix/shared';

/** Prisma skip/take pair for a validated pagination query (spec 005). */
export function pageArgs(query: PaginationQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.perPage, take: query.perPage };
}
