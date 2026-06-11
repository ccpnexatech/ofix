'use client';

import { Role } from '@ofix/shared';
import { Bell, ClipboardList, LayoutDashboard, LogOut, MapPin, Search, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, type ReactNode } from 'react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Sidebar,
  SidebarItem,
  Skeleton,
  ThemeToggle,
  ToastProvider,
} from '../../design-system';
import { BranchSelector } from '../../features/dashboard/branch-selector';
import { FiaPanel } from '../../features/assistant/fia-panel';
import { TourLauncher } from '../../features/tour/tour-launcher';
import { TourProvider } from '../../features/tour/tour-provider';
import { AuthProvider, useAuth } from '../../lib/auth';
import { QueryProvider } from '../../lib/query';

function AppChrome({ children }: { children: ReactNode }) {
  const { user, status, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status !== 'authenticated' || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex w-72 flex-col gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar className="sticky top-0 h-screen shrink-0 max-lg:hidden">
        <SidebarItem
          icon={<LayoutDashboard />}
          label="Dashboard"
          href="/dashboard"
          linkComponent={Link}
          active={pathname.startsWith('/dashboard')}
        />
        <SidebarItem
          icon={<ClipboardList />}
          label="Ordens de serviço"
          href="/orders"
          linkComponent={Link}
          active={pathname.startsWith('/orders')}
        />
        <SidebarItem
          icon={<Users />}
          label="Clientes"
          href="/customers"
          linkComponent={Link}
          active={pathname.startsWith('/customers')}
        />
        <SidebarItem
          icon={<MapPin />}
          label="Filiais"
          href="/branches/map"
          linkComponent={Link}
          active={pathname.startsWith('/branches')}
        />
        {user.role === Role.ADMIN && (
          <SidebarItem
            icon={<Settings />}
            label="Usuários"
            href="/settings/users"
            linkComponent={Link}
            active={pathname.startsWith('/settings')}
          />
        )}
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface-raised px-4 py-2.5">
          <form
            className="relative max-w-md flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get('q');
              if (typeof value === 'string' && value.trim() !== '') {
                router.push(`/orders?search=${encodeURIComponent(value.trim())}`);
              }
            }}
          >
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-faint"
            />
            <Input
              name="q"
              type="search"
              placeholder="Buscar OS, cliente ou equipamento…"
              aria-label="Busca global"
              className="pl-9"
              data-tour="global-search"
            />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <Suspense fallback={null}>
              <BranchSelector />
            </Suspense>
            <ThemeToggle data-tour="theme-toggle" />
            <Button variant="ghost" size="sm" aria-label="Notificações" disabled>
              <Bell className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Menu do usuário"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-text-on-brand"
              >
                {initials}
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>
                  {user.name}
                  <span className="block font-normal text-text-faint">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    void logout();
                  }}
                >
                  <LogOut aria-hidden className="h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
        <TourLauncher />
        <FiaPanel />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ToastProvider>
          <TourProvider>
            <AppChrome>{children}</AppChrome>
          </TourProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
