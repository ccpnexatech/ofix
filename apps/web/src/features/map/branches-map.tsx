'use client';

import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';

import { cn } from '../../design-system/cn';

export interface MapBranch {
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string | null;
  lat: number;
  lng: number;
}

// Own brand pin (divIcon): no leaflet image assets to configure, on-identity.
const PIN = L.divIcon({
  html: `<svg viewBox="0 0 32 40" width="32" height="40" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 0C7.2 0 0 7.1 0 15.8 0 27.7 16 40 16 40s16-12.3 16-24.2C32 7.1 24.8 0 16 0Z" fill="#F59E0B"/>
    <circle cx="16" cy="15.5" r="6" fill="#451F04"/>
  </svg>`,
  className: '',
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -36],
});

export function directionsUrl(branch: MapBranch): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${String(branch.lat)},${String(branch.lng)}`;
}

/** OSM map with one pin per branch (react-leaflet — spec 006). Client-only. */
export default function BranchesMap({
  branches,
  className,
}: {
  branches: MapBranch[];
  className?: string;
}) {
  if (branches.length === 0) {
    return null;
  }
  const bounds = L.latLngBounds(branches.map((branch) => [branch.lat, branch.lng]));

  return (
    <MapContainer
      bounds={bounds.pad(0.35)}
      scrollWheelZoom={false}
      // z-0 contains Leaflet's internal z-indexes (200–1000) in their own
      // stacking context; without it the map paints over page overlays (tour).
      className={cn('z-0', className ?? 'h-96 w-full rounded-lg border border-border')}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {branches.map((branch) => (
        <Marker key={`${branch.name}-${String(branch.lat)}`} position={[branch.lat, branch.lng]} icon={PIN}>
          <Popup>
            <strong>{branch.name}</strong>
            <br />
            {branch.address} — {branch.city}/{branch.state}
            {branch.phone && (
              <>
                <br />
                <a href={`tel:${branch.phone.replace(/\D/g, '')}`}>{branch.phone}</a>
              </>
            )}
            <br />
            <a href={directionsUrl(branch)} target="_blank" rel="noreferrer">
              Como chegar
            </a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
