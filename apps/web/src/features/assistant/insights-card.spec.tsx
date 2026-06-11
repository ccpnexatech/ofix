import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InsightsCard } from './insights-card';

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/api', () => ({
  apiFetch: apiFetchMock,
  getAccessToken: () => 'token',
}));

function renderCard() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <InsightsCard branchId={null} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
});
afterEach(cleanup);

describe('InsightsCard (spec 010)', () => {
  it('starts empty, shows loading and then the insights with generation time', async () => {
    let release: (value: unknown) => void = () => undefined;
    apiFetchMock.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    renderCard();

    // empty state
    expect(screen.getByText(/devolve um diagnóstico prático/)).toBeTruthy();
    fireEvent.click(screen.getByText('Gerar análise'));

    // loading state (skeleton) — mutation state updates asynchronously
    await waitFor(() => {
      expect(screen.getByLabelText('Gerando análise')).toBeTruthy();
    });

    release({
      insights: ['Insight um sobre aprovação.', 'Insight dois sobre atrasos.'],
      generatedAt: new Date().toISOString(),
      cached: true,
    });
    await waitFor(() => {
      expect(screen.getByText('Insight um sobre aprovação.')).toBeTruthy();
    });
    expect(screen.getByText(/do cache \(15 min\)/)).toBeTruthy();
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/assistant/dashboard-insights',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows the friendly error state with a retry button', async () => {
    apiFetchMock.mockRejectedValue(new Error('503'));
    renderCard();
    fireEvent.click(screen.getByText('Gerar análise'));

    await waitFor(() => {
      expect(screen.getByText('Análise indisponível no momento.')).toBeTruthy();
    });
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
  });
});
