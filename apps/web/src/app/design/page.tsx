import { notFound } from 'next/navigation';

import { DesignShowcase } from './showcase';

/**
 * Internal visual-homologation route (spec 007): every component in both
 * themes. Dev-only — production answers 404.
 */
export default function DesignPage() {
  if (process.env.NODE_ENV === 'production' && process.env.OFIX_ENABLE_DESIGN_ROUTE !== 'true') {
    notFound();
  }
  return <DesignShowcase />;
}
