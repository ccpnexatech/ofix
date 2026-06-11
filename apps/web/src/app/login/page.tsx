'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginBodySchema, type LoginBody } from '@ofix/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Card, FormField, Input, Logo, ThemeToggle } from '../../design-system';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login, status } = useAuth();
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [needsTenant, setNeedsTenant] = useState(false);

  const form = useForm<LoginBody>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { email: '', password: '' },
  });

  // Already signed in (e.g. back button): straight to the app.
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/orders');
    }
  }, [status, router]);

  const onSubmit = form.handleSubmit(async (body) => {
    setFormError(undefined);
    try {
      await login(body);
      router.replace('/orders');
    } catch (error) {
      if (error instanceof ApiError) {
        const code = (error.details as { code?: string } | undefined)?.code;
        if (code === 'TENANT_SLUG_REQUIRED') {
          // Same e-mail in more than one tenant (spec 003): ask for the slug.
          setNeedsTenant(true);
          setFormError('Este e-mail existe em mais de uma empresa. Informe o identificador.');
          return;
        }
        setFormError(error.message);
        return;
      }
      setFormError('Não foi possível entrar. Verifique sua conexão e tente novamente.');
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center gap-2 text-text">
          <Logo className="h-10" />
          <p className="text-sm text-text-muted">Gestão de ordens de serviço</p>
        </div>
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
          <FormField label="E-mail" htmlFor="email" error={form.formState.errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="voce@empresa.com.br"
              invalid={Boolean(form.formState.errors.email)}
              {...form.register('email')}
            />
          </FormField>
          <FormField
            label="Senha"
            htmlFor="password"
            error={form.formState.errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              invalid={Boolean(form.formState.errors.password)}
              {...form.register('password')}
            />
          </FormField>
          {needsTenant && (
            <FormField
              label="Identificador da empresa"
              htmlFor="tenantSlug"
              hint="Ex.: tecnorte"
              error={form.formState.errors.tenantSlug?.message}
            >
              <Input id="tenantSlug" autoFocus {...form.register('tenantSlug')} />
            </FormField>
          )}
          {formError && (
            <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}
          <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
            Entrar
          </Button>
        </form>
      </Card>
    </main>
  );
}
