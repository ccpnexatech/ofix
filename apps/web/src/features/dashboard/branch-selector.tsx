'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../design-system';
import { branchKeys, listBranches } from '../orders/queries';
import { useAuth } from '../../lib/auth';

/**
 * Global branch selector (spec 006): persisted in the URL (?branchId=) so the
 * view is shareable; locked for fixed-branch users (RN-12/RN-14 — the API
 * enforces it anyway).
 */
export function BranchSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const branches = useQuery({ queryKey: branchKeys.list, queryFn: listBranches });
  const locked = user !== undefined && user.branchId !== null;
  const value = locked ? (user.branchId ?? '') : (searchParams.get('branchId') ?? 'ALL');

  return (
    <Select
      value={value}
      disabled={locked}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams);
        if (next === 'ALL') {
          params.delete('branchId');
        } else {
          params.set('branchId', next);
        }
        const qs = params.toString();
        router.replace(qs === '' ? pathname : `${pathname}?${qs}`);
      }}
    >
      <SelectTrigger
        aria-label="Filial em exibição"
        className="w-44 max-sm:hidden"
        data-tour="branch-selector"
      >
        <SelectValue placeholder="Filial" />
      </SelectTrigger>
      <SelectContent>
        {!locked && <SelectItem value="ALL">Todas as filiais</SelectItem>}
        {(branches.data ?? []).map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
