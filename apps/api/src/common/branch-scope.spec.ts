import { ForbiddenException } from '@nestjs/common';
import { Role } from '@ofix/shared';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from './authenticated-user';
import { assertBranchAccess, branchScopeWhere } from './branch-scope';

function user(branchId: string | null): AuthenticatedUser {
  return { id: 'u1', tenantId: 't1', branchId, role: Role.ATTENDANT, name: 'Test' };
}

describe('branchScopeWhere', () => {
  it('returns empty filter for tenant-wide users (branchId null)', () => {
    expect(branchScopeWhere(user(null))).toEqual({});
  });

  it('filters by the fixed branch of the user', () => {
    expect(branchScopeWhere(user('b1'))).toEqual({ branchId: 'b1' });
  });
});

describe('assertBranchAccess', () => {
  it('allows tenant-wide users on any branch', () => {
    expect(() => {
      assertBranchAccess(user(null), 'b2');
    }).not.toThrow();
  });

  it('allows a fixed-branch user on their own branch', () => {
    expect(() => {
      assertBranchAccess(user('b1'), 'b1');
    }).not.toThrow();
  });

  it('throws 403 when a fixed-branch user touches another branch', () => {
    expect(() => {
      assertBranchAccess(user('b1'), 'b2');
    }).toThrow(ForbiddenException);
  });
});
