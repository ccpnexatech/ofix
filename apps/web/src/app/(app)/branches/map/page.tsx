'use client';

import { Role, type BranchSummary } from '@ofix/shared';
import { useQuery } from '@tanstack/react-query';
import { Copy, MapPin, Pencil, Phone, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

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
import { BranchFormDialog } from '../../../../features/map/branch-form-dialog';
import type { MapBranch } from '../../../../features/map/branches-map';
import { useAuth } from '../../../../lib/auth';

// Leaflet touches window: client-only chunk.
const BranchesMap = dynamic(() => import('../../../../features/map/branches-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full" />,
});

export default function InternalMapPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const branches = useQuery({ queryKey: branchKeys.list, queryFn: listBranches });
  const mapToken = useQuery({ queryKey: dashboardKeys.mapToken, queryFn: getMapToken });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BranchSummary | null>(null);
  const isAdmin = user?.role === Role.ADMIN; // gestão de filial é ADMIN (ADR-013)

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
          <>
            <Button data-tour="copy-map-link" variant="secondary" onClick={copyPublicLink} disabled={!mapToken.isSuccess}>
              <Copy aria-hidden className="h-4 w-4" /> Copiar link público
            </Button>
            {isAdmin && (
              <Button
                data-tour="new-branch"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus aria-hidden className="h-4 w-4" /> Nova filial
              </Button>
            )}
          </>
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
          description={
            isAdmin
              ? 'Cadastre uma filial com latitude/longitude pelo botão "Nova filial" para aparecer no mapa.'
              : 'Peça a um administrador para cadastrar latitude/longitude nas filiais.'
          }
        />
      )}
      {branches.isSuccess && mapBranches.length > 0 && (
        <div data-tour="map-area">
          <BranchesMap branches={mapBranches} />
        </div>
      )}

      {branches.isSuccess && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-tour="branch-cards">
          {branches.data.map((branch) => (
            <Card key={branch.id} className="p-4 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-text">
                <MapPin aria-hidden className="h-4 w-4 text-brand-600" />
                {branch.name}
                {branch.latitude === null && (
                  <span className="text-xs font-normal text-text-faint">(sem coordenadas)</span>
                )}
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    aria-label={`Editar filial ${branch.name}`}
                    onClick={() => {
                      setEditing(branch);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil aria-hidden className="h-3.5 w-3.5" />
                  </Button>
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

      <BranchFormDialog open={formOpen} onOpenChange={setFormOpen} branch={editing} />
    </div>
  );
}
