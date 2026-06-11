import type { PublicQuoteResponse } from '@ofix/shared';
import { CheckCircle2, Clock, MapPin, Phone, XCircle } from 'lucide-react';
import { revalidatePath } from 'next/cache';

import { Logo } from '../../../design-system/logo';

// Public quote page (spec 006): the project's storefront. Mobile-first,
// Server Component + form actions — zero client-side JS beyond what Next ships.

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:3001';

type QuoteState =
  | { kind: 'ok'; quote: PublicQuoteResponse }
  | { kind: 'expired' }
  | { kind: 'not-found' };

async function fetchQuote(token: string): Promise<QuoteState> {
  const response = await fetch(`${API_ORIGIN}/api/v1/public/quotes/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  if (response.status === 410) {
    return { kind: 'expired' };
  }
  if (!response.ok) {
    return { kind: 'not-found' };
  }
  return { kind: 'ok', quote: (await response.json()) as PublicQuoteResponse };
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    cents / 100,
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-4 bg-surface px-4 py-6">
      {children}
      <footer className="mt-auto flex items-center justify-center gap-2 pt-6 text-xs text-text-faint">
        atendimento digital por <Logo className="h-4 text-text-muted" />
      </footer>
    </main>
  );
}

function Notice({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-raised p-8 text-center shadow-sm">
      {icon}
      <h1 className="font-display text-lg font-semibold text-text">{title}</h1>
      <p className="text-sm text-text-muted">{description}</p>
    </div>
  );
}

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const state = await fetchQuote(token);

  async function approve() {
    'use server';
    await fetch(`${API_ORIGIN}/api/v1/public/quotes/${encodeURIComponent(token)}/approve`, {
      method: 'POST',
    });
    revalidatePath(`/q/${token}`);
  }

  async function reject(formData: FormData) {
    'use server';
    const reason = formData.get('reason');
    await fetch(`${API_ORIGIN}/api/v1/public/quotes/${encodeURIComponent(token)}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: typeof reason === 'string' ? reason : '' }),
    });
    revalidatePath(`/q/${token}`);
  }

  if (state.kind === 'not-found') {
    return (
      <Shell>
        <Notice
          icon={<XCircle aria-hidden className="h-10 w-10 text-text-faint" />}
          title="Orçamento não encontrado"
          description="Confira o link recebido ou entre em contato com a assistência."
        />
      </Shell>
    );
  }

  if (state.kind === 'expired') {
    return (
      <Shell>
        <Notice
          icon={<Clock aria-hidden className="h-10 w-10 text-warning" />}
          title="Este orçamento expirou"
          description="O prazo de validade passou. Peça um novo orçamento à assistência — ela pode reenviar o link em segundos."
        />
      </Shell>
    );
  }

  const { company, order, quote } = state.quote;
  const decided = quote.status === 'APPROVED' || quote.status === 'REJECTED';
  const expiresAt = quote.tokenExpiresAt
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(
        new Date(quote.tokenExpiresAt),
      )
    : null;

  return (
    <Shell>
      <header className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4 shadow-sm">
        <h1 className="font-display text-lg font-semibold text-text">{company.name}</h1>
        <p className="flex items-center gap-1.5 text-sm text-text-muted">
          <MapPin aria-hidden className="h-3.5 w-3.5" />
          {company.branch.name} — {company.branch.city}/{company.branch.state}
        </p>
        {company.branch.phone && (
          <a
            href={`tel:${company.branch.phone.replace(/\D/g, '')}`}
            className="flex items-center gap-1.5 text-sm text-brand-600"
          >
            <Phone aria-hidden className="h-3.5 w-3.5" />
            {company.branch.phone}
          </a>
        )}
      </header>

      <section className="rounded-lg border border-border bg-surface-raised p-4 shadow-sm">
        <p className="text-xs font-medium tracking-wide text-text-faint uppercase">
          Ordem de serviço
        </p>
        <p className="font-mono text-sm font-semibold text-text">{order.code}</p>
        <p className="mt-1 text-sm text-text">{order.equipment}</p>
        <p className="text-sm text-text-muted">“{order.reportedIssue}”</p>
      </section>

      <section className="rounded-lg border border-border bg-surface-raised p-4 shadow-sm">
        <h2 className="mb-2 font-display text-base font-semibold text-text">
          Orçamento <span className="text-text-faint">v{quote.version}</span>
        </h2>
        <ul className="divide-y divide-border text-sm">
          {quote.items.map((item, index) => (
            <li key={index} className="flex items-start justify-between gap-3 py-2">
              <span>
                {item.description}
                <span className="block text-xs text-text-faint">
                  {item.kind === 'LABOR' ? 'mão de obra' : 'peça'} × {item.quantity}
                </span>
              </span>
              <span data-numeric className="shrink-0 text-text">
                {formatCents(item.subtotalCents)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between border-t-2 border-border pt-3">
          <span className="text-sm font-medium text-text-muted">Total</span>
          <span data-numeric className="font-display text-xl font-bold text-text">
            {formatCents(quote.totalCents)}
          </span>
        </div>
        {expiresAt && quote.status === 'SENT' && (
          <p className="mt-2 text-xs text-text-faint">Válido até {expiresAt}.</p>
        )}
      </section>

      {quote.status === 'APPROVED' && (
        <Notice
          icon={<CheckCircle2 aria-hidden className="h-10 w-10 text-success" />}
          title="Orçamento aprovado"
          description="A assistência já foi avisada e o reparo entrará na fila. Obrigado!"
        />
      )}

      {quote.status === 'REJECTED' && (
        <Notice
          icon={<XCircle aria-hidden className="h-10 w-10 text-danger" />}
          title="Orçamento recusado"
          description={
            quote.rejectionReason
              ? `Motivo registrado: “${quote.rejectionReason}”. Se mudar de ideia, fale com a assistência.`
              : 'Se mudar de ideia, fale com a assistência.'
          }
        />
      )}

      {!decided && quote.status === 'SENT' && (
        <section className="flex flex-col gap-3">
          <form action={approve}>
            <button
              type="submit"
              className="h-12 w-full rounded-md bg-brand-500 font-display text-base font-semibold text-text-on-brand transition-colors hover:bg-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              Aprovar orçamento
            </button>
          </form>
          <details className="rounded-md border border-border bg-surface-raised p-3">
            <summary className="cursor-pointer text-sm font-medium text-text-muted">
              Prefiro recusar
            </summary>
            <form action={reject} className="mt-3 flex flex-col gap-2">
              <label htmlFor="reason" className="text-sm font-medium text-text">
                Conte o motivo (mínimo 5 caracteres)
              </label>
              <textarea
                id="reason"
                name="reason"
                required
                minLength={5}
                rows={3}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
              />
              <button
                type="submit"
                className="h-11 w-full rounded-md border border-danger font-medium text-danger transition-colors hover:bg-danger-bg"
              >
                Recusar orçamento
              </button>
            </form>
          </details>
        </section>
      )}
    </Shell>
  );
}
