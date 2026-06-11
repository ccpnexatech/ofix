import type { PublicMapResponse } from '@ofix/shared';
import { MapPin, Navigation, Phone, XCircle } from 'lucide-react';

import { Logo } from '../../../design-system/logo';
import { PublicMapClient } from './map-client';

// Public shareable branches map (spec 006 / RN-15). Server Component fetches;
// the Leaflet map hydrates client-side; the list below keeps the page useful
// for SEO/accessibility even without JS.

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:3001';

async function fetchMap(mapToken: string): Promise<PublicMapResponse | null> {
  const response = await fetch(
    `${API_ORIGIN}/api/v1/public/map/${encodeURIComponent(mapToken)}`,
    { cache: 'no-store' },
  );
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as PublicMapResponse;
}

function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${String(lat)},${String(lng)}`;
}

export default async function PublicMapPage({
  params,
}: {
  params: Promise<{ mapToken: string }>;
}) {
  const { mapToken } = await params;
  const data = await fetchMap(mapToken);

  if (data === null) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
        <XCircle aria-hidden className="h-10 w-10 text-text-faint" />
        <h1 className="font-display text-lg font-semibold text-text">Mapa não encontrado</h1>
        <p className="text-sm text-text-muted">
          O link pode ter sido substituído. Peça o endereço atualizado à assistência.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-bold text-text">{data.tenantName}</h1>
        <p className="text-sm text-text-muted">
          {data.branches.length === 1
            ? 'Nossa unidade no mapa'
            : `Nossas ${String(data.branches.length)} unidades no mapa`}
        </p>
      </header>

      <PublicMapClient branches={data.branches} />

      <ul className="flex flex-col gap-3">
        {data.branches.map((branch) => (
          <li
            key={branch.name}
            className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4 shadow-sm"
          >
            <p className="flex items-center gap-1.5 font-medium text-text">
              <MapPin aria-hidden className="h-4 w-4 text-brand-600" />
              {branch.name}
            </p>
            <p className="text-sm text-text-muted">
              {branch.address} — {branch.city}/{branch.state}
            </p>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              {branch.phone && (
                <a
                  href={`tel:${branch.phone.replace(/\D/g, '')}`}
                  className="inline-flex items-center gap-1.5 text-brand-600 hover:underline"
                >
                  <Phone aria-hidden className="h-3.5 w-3.5" />
                  {branch.phone}
                </a>
              )}
              <a
                href={directionsUrl(branch.lat, branch.lng)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-brand-600 hover:underline"
              >
                <Navigation aria-hidden className="h-3.5 w-3.5" />
                Como chegar
              </a>
            </div>
          </li>
        ))}
      </ul>

      <footer className="mt-auto flex items-center justify-center gap-2 pt-6 text-xs text-text-faint">
        mapa por <Logo className="h-4 text-text-muted" />
      </footer>
    </main>
  );
}
