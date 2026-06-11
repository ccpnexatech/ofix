'use client';

import dynamic from 'next/dynamic';

import { Skeleton } from '../../../design-system/skeleton';
import type { MapBranch } from '../../../features/map/branches-map';

const BranchesMap = dynamic(() => import('../../../features/map/branches-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full" />,
});

export function PublicMapClient({ branches }: { branches: MapBranch[] }) {
  return <BranchesMap branches={branches} className="h-72 w-full rounded-lg border border-border" />;
}
