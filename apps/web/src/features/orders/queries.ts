import type {
  AssignTechnicianBody,
  CreateOrderBody,
  OrderAction,
  UpdateOrderBody,
  UpdateQuoteItemsBody,
} from '@ofix/shared';

import { apiFetch } from '../../lib/api';
import type {
  Branch,
  OrderDetail,
  OrderEventView,
  OrderListItem,
  Paginated,
  QuoteView,
} from './types';

/** Standardized query keys (spec 001). */
export const orderKeys = {
  all: ['orders'] as const,
  list: (search: string) => ['orders', 'list', search] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
  events: (id: string) => ['orders', 'events', id] as const,
};

export const branchKeys = { list: ['branches'] as const };

export async function listOrders(searchParams: string): Promise<Paginated<OrderListItem>> {
  return apiFetch(`/orders${searchParams === '' ? '' : `?${searchParams}`}`);
}

export async function getOrder(id: string): Promise<OrderDetail> {
  return apiFetch(`/orders/${id}`);
}

export async function getOrderEvents(id: string): Promise<OrderEventView[]> {
  return apiFetch(`/orders/${id}/events`);
}

export async function listBranches(): Promise<Branch[]> {
  return apiFetch('/branches');
}

export async function createOrder(body: CreateOrderBody): Promise<OrderDetail> {
  return apiFetch('/orders', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateOrder(id: string, body: UpdateOrderBody): Promise<OrderDetail> {
  return apiFetch(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function assignTechnician(
  id: string,
  body: AssignTechnicianBody,
): Promise<OrderDetail> {
  return apiFetch(`/orders/${id}/assign`, { method: 'POST', body: JSON.stringify(body) });
}

export async function transitionOrder(
  id: string,
  action: OrderAction,
  reason?: string,
): Promise<OrderDetail> {
  return apiFetch(`/orders/${id}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ action, ...(reason === undefined ? {} : { payload: { reason } }) }),
  });
}

export async function reopenWarranty(id: string): Promise<OrderDetail> {
  return apiFetch(`/orders/${id}/warranty-reopen`, { method: 'POST', body: JSON.stringify({}) });
}

export async function createQuoteVersion(orderId: string): Promise<QuoteView> {
  return apiFetch(`/orders/${orderId}/quotes`, { method: 'POST' });
}

export async function updateQuoteItems(
  quoteId: string,
  body: UpdateQuoteItemsBody,
): Promise<QuoteView> {
  return apiFetch(`/quotes/${quoteId}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function sendQuote(quoteId: string): Promise<OrderDetail> {
  return apiFetch(`/quotes/${quoteId}/send`, { method: 'POST' });
}
