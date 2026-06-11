'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import type { MapBranch } from '../../../features/map/branches-map';

const BranchesMap = dynamic(() => import('../../../features/map/branches-map'), {
  ssr: false,
});

/**
 * Map facade (web.dev pattern): a tiny local blurred snapshot paints
 * immediately and anchors the LCP; the interactive Leaflet map (and its
 * remote OSM tiles) mounts after the browser goes idle.
 */
export function PublicMapClient({ branches }: { branches: MapBranch[] }) {
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(
        () => {
          setInteractive(true);
        },
        { timeout: 2000 },
      );
      return () => {
        cancelIdleCallback(id);
      };
    }
    const id = setTimeout(() => {
      setInteractive(true);
    }, 300);
    return () => {
      clearTimeout(id);
    };
  }, []);

  return (
    <div className="relative h-72 w-full overflow-hidden rounded-lg border border-border">
      <Image
        src="/map-placeholder.jpg"
        alt=""
        aria-hidden
        fill
        priority
        sizes="(max-width: 672px) 100vw, 672px"
        className="object-cover"
      />
      {interactive && (
        <BranchesMap branches={branches} className="absolute inset-0 h-full w-full" />
      )}
    </div>
  );
}
