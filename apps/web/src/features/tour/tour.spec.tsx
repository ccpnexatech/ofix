import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TourProvider, useTour } from './tour-provider';
import { defineTour } from './types';

// The engine talks to /auth/me and /users/me/tours: mock the api client.
const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/api', () => ({ apiFetch: apiFetchMock }));
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ status: 'authenticated' }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/sem-tour' }));

const FAKE_TOUR = defineTour({
  id: 'fake',
  steps: [
    { target: '#alvo-a', title: 'Passo A', body: 'Primeiro passo.' },
    { target: '#alvo-inexistente', title: 'Fantasma', body: 'Nunca aparece.' },
    { target: '#alvo-b', title: 'Passo B', body: 'Último passo.' },
  ],
});

function Harness() {
  const { start } = useTour();
  return (
    <div>
      <div id="alvo-a">Alvo A</div>
      <div id="alvo-b">Alvo B</div>
      <button
        type="button"
        onClick={() => {
          start(FAKE_TOUR);
        }}
      >
        abrir tour
      </button>
    </div>
  );
}

function renderTour() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TourProvider>
        <Harness />
      </TourProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((path: string) => {
    if (path === '/auth/me') {
      return Promise.resolve({ completedTours: [] });
    }
    return Promise.resolve({ completedTours: ['fake'] });
  });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe('tour engine (spec 009)', () => {
  it('opens on demand, shows progress and navigates forward and back', () => {
    renderTour();
    fireEvent.click(screen.getByText('abrir tour'));

    expect(screen.getByText('Passo A')).toBeTruthy();
    expect(screen.getByText('1 de 3')).toBeTruthy();

    // missing middle target is skipped silently -> jumps straight to B
    fireEvent.click(screen.getByText('Próximo'));
    expect(screen.getByText('Passo B')).toBeTruthy();
    expect(screen.getByText('3 de 3')).toBeTruthy();
    expect(screen.getByText('Concluir')).toBeTruthy();

    // and back over the hole too
    fireEvent.click(screen.getByText('Voltar'));
    expect(screen.getByText('Passo A')).toBeTruthy();
  });

  it('completing the last step persists the tour id', async () => {
    renderTour();
    fireEvent.click(screen.getByText('abrir tour'));
    fireEvent.click(screen.getByText('Próximo')); // A -> B
    fireEvent.click(screen.getByText('Concluir'));

    expect(screen.queryByText('Passo B')).toBeNull();
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/users/me/tours',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ tourId: 'fake' }) }),
      );
    });
  });

  it('Pular closes immediately and also persists (spec 009)', async () => {
    renderTour();
    fireEvent.click(screen.getByText('abrir tour'));
    fireEvent.click(screen.getByText('Pular'));

    expect(screen.queryByText('Passo A')).toBeNull();
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/users/me/tours',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('announces the step to screen readers and keeps keyboard navigation', () => {
    renderTour();
    fireEvent.click(screen.getByText('abrir tour'));

    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toContain('Passo 1 de 3');

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    expect(screen.getByText('Passo B')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' });
    expect(screen.getByText('Passo A')).toBeTruthy();
  });

  it('regression: hidden targets do not inflate the count nor turn the last visible step into a silent close', () => {
    // Bug report: tour said "2 de 3" and "Próximo" closed it — the 3rd target
    // did not exist for that role. Visible steps must drive count and labels.
    renderTour();
    fireEvent.click(screen.getByText('abrir tour'));

    // Only 2 of the 3 targets exist: the count must say so.
    expect(screen.getByText('1 de 2')).toBeTruthy();

    fireEvent.click(screen.getByText('Próximo'));
    expect(screen.getByText('2 de 2')).toBeTruthy();
    // Last VISIBLE step must offer "Concluir", never a deceiving "Próximo".
    expect(screen.queryByText('Próximo')).toBeNull();
    expect(screen.getByText('Concluir')).toBeTruthy();
  });

  it('warns in dev when a target is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderTour();
    fireEvent.click(screen.getByText('abrir tour'));
    fireEvent.click(screen.getByText('Próximo'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('alvo-inexistente'));
    warn.mockRestore();
  });
});
