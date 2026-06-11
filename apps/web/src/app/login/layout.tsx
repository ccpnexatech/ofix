'use client';

import type { ReactNode } from 'react';

import { ToastProvider } from '../../design-system';
import { AuthProvider } from '../../lib/auth';
import { QueryProvider } from '../../lib/query';

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
