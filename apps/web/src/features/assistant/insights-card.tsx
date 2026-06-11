'use client';

import { useMutation } from '@tanstack/react-query';
import { RefreshCw, Sparkles } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '../../design-system';
import { getInsights } from './api';

/**
 * "Análise da IA" dashboard card (spec 010): empty state with a generate
 * button, skeleton while loading, result with generation time and refresh.
 * The API caches per tenant+filter for 15 minutes.
 */
export function InsightsCard({ branchId }: { branchId: string | null }) {
  const generate = useMutation({ mutationFn: () => getInsights(branchId) });

  return (
    <Card data-tour="ai-insights">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Sparkles aria-hidden className="h-4 w-4 text-brand-500" /> Análise da IA
        </CardTitle>
        {generate.isSuccess && (
          <Button
            variant="ghost"
            size="sm"
            disabled={generate.isPending}
            onClick={() => {
              generate.mutate();
            }}
          >
            <RefreshCw aria-hidden className="h-4 w-4" />
            <span className="sr-only">Gerar novamente</span>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {generate.isIdle && (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-text-muted">
              A Fia lê as métricas desta tela e devolve um diagnóstico prático da operação.
            </p>
            <Button
              size="sm"
              onClick={() => {
                generate.mutate();
              }}
            >
              Gerar análise
            </Button>
          </div>
        )}

        {generate.isPending && (
          <div className="space-y-2" aria-label="Gerando análise">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        )}

        {generate.isError && (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-text-muted">Análise indisponível no momento.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                generate.mutate();
              }}
            >
              Tentar de novo
            </Button>
          </div>
        )}

        {generate.isSuccess && (
          <div className="space-y-2">
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-text">
              {generate.data.insights.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
            <p className="text-xs text-text-faint">
              Gerada às{' '}
              {new Date(generate.data.generatedAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {generate.data.cached ? ' · do cache (15 min)' : ''}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
