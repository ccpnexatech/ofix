'use client';

import { useQuery } from '@tanstack/react-query';
import { Copy, MapPin, Phone } from 'lucide-react';
import dynamic from 'next/dynamic';

import {
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Skeleton,
  useToast,
} from '../../../../design-system';
import { dashboardKeys, getMapToken } from '../../../../features/dashboard/queries';
import { branchKeys, listBranches } from '../../../../features/orders/queries';
import type { MapBranch } from '../../../../features/map/branches-map';

// Leaflet touches window: client-only chunk.
const BranchesMap = dynamic(() => import('../../../../features/map/branches-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full" />,
});

export default function InternalMapPage() {
  const { toast } = useToast();
  const branches = useQuery({ queryKey: branchKeys.list, queryFn: listBranches });
  const mapToken = useQuery({ queryKey: dashboardKeys.mapToken, queryFn: getMapToken });

  const mapBranches: MapBranch[] = (branches.data ?? [])
    .filter((branch) => branch.latitude !== null && branch.longitude !== null)
    .map((branch) => ({
      name: branch.name,
      address: branch.address,
      city: branch.city,
      state: branch.state,
      phone: branch.phone,
      lat: Number(branch.latitude),
      lng: Number(branch.longitude),
    }));

  function copyPublicLink() {
    const token = mapToken.data?.publicMapToken;
    if (token === undefined) {
      return;
    }
    const url = `${window.location.origin}/m/${token}`;
    void navigator.clipboard.writeText(url).then(() => {
      toast({ title: 'Link público do mapa copiado', description: url, tone: 'info' });
    });
  }

  return (
    <div className="flex flex-col gap-4" data-tour="branches-map">
      <PageHeader
        title="Filiais no mapa"
        description="Unidades ativas com localização — compartilhe o mapa público com clientes."
        actions={
          <Button variant="secondary" onClick={copyPublicLink} disabled={!mapToken.isSuccess}>
            <Copy aria-hidden className="h-4 w-4" /> Copiar link público
          </Button>
        }
      />

      {branches.isPending && <Skeleton className="h-96 w-full" />}
      {branches.isError && (
        <EmptyState
          title="Não foi possível carregar as filiais"
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void branches.refetch();
              }}
            >
              Tentar de novo
            </Button>
          }
        />
      )}
      {branches.isSuccess && mapBranches.length === 0 && (
        <EmptyState
          title="Nenhuma filial georreferenciada"
          description="Cadastre latitude/longitude via scripts/create-branch.ts para aparecer no mapa."
        />
      )}
      {branches.isSuccess && mapBranches.length > 0 && <BranchesMap branches={mapBranches} />}

      {branches.isSuccess && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {branches.data.map((branch) => (
            <Card key={branch.id} className="p-4 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-text">
                <MapPin aria-hidden className="h-4 w-4 text-brand-600" />
                {branch.name}
                {branch.latitude === null && (
                  <span className="text-xs font-normal text-text-faint">(sem coordenadas)</span>
                )}
              </p>
              <CardContent className="p-0 pt-1 text-text-muted">
                {branch.address} — {branch.city}/{branch.state}
                {branch.phone && (
                  <span className="mt-1 flex items-center gap-1.5">
                    <Phone aria-hidden className="h-3.5 w-3.5" />
                    {branch.phone}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
