import { OrderAction, OrderStatus, Role } from '@ofix/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TransitionPanel } from './transition-panel';

afterEach(cleanup);

const ME = 'user-1';
const OTHER = 'user-2';

function renderPanel(
  status: OrderStatus,
  role: Role,
  assignedTechnicianId: string | null,
  onTransition = vi.fn().mockResolvedValue(undefined),
) {
  render(
    <TransitionPanel
      status={status}
      user={{ id: ME, role }}
      assignedTechnicianId={assignedTechnicianId}
      onTransition={onTransition as (action: OrderAction, reason?: string) => Promise<void>}
    />,
  );
  return onTransition;
}

function renderedActions(): string[] {
  return Array.from(document.querySelectorAll('[data-action]')).map(
    (el) => el.getAttribute('data-action') ?? '',
  );
}

/**
 * Spec 006 DoD: buttons per state x role, asserted against an EXPLICIT
 * expectation table (mirrors spec 004), not recomputed from the same machine.
 */
const TABLE: {
  status: OrderStatus;
  role: Role;
  assigned: string | null;
  expected: OrderAction[];
}[] = [
  { status: OrderStatus.RECEIVED, role: Role.ADMIN, assigned: null, expected: ['START_DIAGNOSIS', 'CANCEL'] },
  { status: OrderStatus.RECEIVED, role: Role.TECHNICIAN, assigned: ME, expected: ['START_DIAGNOSIS'] },
  { status: OrderStatus.RECEIVED, role: Role.TECHNICIAN, assigned: OTHER, expected: [] },
  { status: OrderStatus.RECEIVED, role: Role.ATTENDANT, assigned: null, expected: [] },
  { status: OrderStatus.IN_DIAGNOSIS, role: Role.TECHNICIAN, assigned: ME, expected: ['SEND_QUOTE'] },
  { status: OrderStatus.QUOTE_SENT, role: Role.ADMIN, assigned: null, expected: ['SEND_QUOTE', 'APPROVE_QUOTE', 'REJECT_QUOTE', 'CANCEL'] },
  { status: OrderStatus.QUOTE_SENT, role: Role.TECHNICIAN, assigned: ME, expected: ['SEND_QUOTE'] },
  { status: OrderStatus.QUOTE_SENT, role: Role.ATTENDANT, assigned: null, expected: [] },
  { status: OrderStatus.APPROVED, role: Role.TECHNICIAN, assigned: ME, expected: ['START_REPAIR'] },
  { status: OrderStatus.REJECTED, role: Role.ADMIN, assigned: null, expected: ['SEND_QUOTE', 'CANCEL'] },
  { status: OrderStatus.IN_REPAIR, role: Role.TECHNICIAN, assigned: ME, expected: ['MARK_READY'] },
  { status: OrderStatus.READY, role: Role.ATTENDANT, assigned: null, expected: ['DELIVER'] },
  { status: OrderStatus.READY, role: Role.TECHNICIAN, assigned: ME, expected: [] },
  { status: OrderStatus.DELIVERED, role: Role.ADMIN, assigned: null, expected: [] },
  { status: OrderStatus.CANCELED, role: Role.ADMIN, assigned: null, expected: [] },
];

describe('TransitionPanel — buttons per state x role (shared machine + matrix)', () => {
  it.each(TABLE)(
    '$status as $role (assigned=$assigned) renders $expected',
    ({ status, role, assigned, expected }) => {
      renderPanel(status, role, assigned);
      expect(renderedActions().sort()).toEqual([...expected].sort());
    },
  );

  it('non-destructive action fires immediately without a reason', () => {
    const onTransition = renderPanel(OrderStatus.RECEIVED, Role.ADMIN, null);
    fireEvent.click(screen.getByRole('button', { name: /Iniciar diagnóstico/ }));
    expect(onTransition).toHaveBeenCalledWith('START_DIAGNOSIS', undefined);
  });

  it('CANCEL opens the reason dialog and blocks until 10 chars (RN-08)', () => {
    const onTransition = renderPanel(OrderStatus.RECEIVED, Role.ADMIN, null);
    fireEvent.click(screen.getByRole('button', { name: /Cancelar OS/ }));

    const confirm = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirm).toHaveProperty('disabled', true);
    expect(onTransition).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'curto' } });
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByLabelText('Motivo'), {
      target: { value: 'cliente desistiu do reparo' },
    });
    const enabled = screen.getByRole('button', { name: 'Confirmar' });
    expect(enabled).toHaveProperty('disabled', false);
    fireEvent.click(enabled);
    expect(onTransition).toHaveBeenCalledWith('CANCEL', 'cliente desistiu do reparo');
  });
});
