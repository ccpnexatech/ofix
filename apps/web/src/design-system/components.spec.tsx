import { OrderStatus } from '@ofix/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Button } from './button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './dialog';
import { ORDER_STATUS_META, StatusBadge } from './status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

afterEach(cleanup);

describe('Button', () => {
  it('renders all variants without leaking raw colors into the API', () => {
    render(
      <>
        <Button>Primário</Button>
        <Button variant="secondary">Secundário</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('blocks interaction and shows a spinner while loading', () => {
    let clicks = 0;
    render(
      <Button
        loading
        onClick={() => {
          clicks += 1;
        }}
      >
        Salvar
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(button).toHaveProperty('disabled', true);
    fireEvent.click(button);
    expect(clicks).toBe(0);
    expect(button.querySelector('.animate-spin')).not.toBeNull();
  });

  it('defaults to type=button (no accidental form submits)', () => {
    render(<Button>Ok</Button>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });
});

describe('StatusBadge', () => {
  it('communicates EVERY status with icon + text, not color alone (spec 007)', () => {
    render(
      <>
        {Object.values(OrderStatus).map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </>,
    );
    for (const status of Object.values(OrderStatus)) {
      const badge = document.querySelector(`[data-status="${status}"]`);
      expect(badge, status).not.toBeNull();
      // Text label
      expect(badge?.textContent).toBe(ORDER_STATUS_META[status].label);
      // Icon present
      expect(badge?.querySelector('svg'), `${status} icon`).not.toBeNull();
      // Token-based classes, never raw colors
      expect(badge?.className).toContain(`status-`);
    }
  });

  it('has a distinct label per status', () => {
    const labels = Object.values(ORDER_STATUS_META).map((meta) => meta.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('Dialog', () => {
  it('opens on trigger click and closes via the close button', () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary">Abrir</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Confirmar ação</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Confirmar ação')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Table', () => {
  it('renders dense rows with sticky header and tabular numbers wiring', () => {
    render(
      <Table>
        <TableHeader data-testid="thead">
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>OS-2026-0001</TableCell>
            <TableCell>R$ 350,00</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByTestId('thead').className).toContain('sticky');
    expect(screen.getByText('OS-2026-0001')).toBeTruthy();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  });
});
