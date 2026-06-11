import type {
  CreateCustomerBody,
  CreateEquipmentBody,
  UpdateCustomerBody,
} from '@ofix/shared';

import { apiFetch } from '../../lib/api';
import type { OrderListItem, Paginated } from '../orders/types';

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  document: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
}

export interface EquipmentView {
  id: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string | null;
  notes: string | null;
}

export interface CustomerDetail extends CustomerSummary {
  equipments: EquipmentView[];
}

/** Standardized query keys (spec 001). */
export const customerKeys = {
  list: (search: string) => ['customers', 'list', search] as const,
  detail: (id: string) => ['customers', 'detail', id] as const,
  orders: (id: string) => ['customers', 'orders', id] as const,
};

export async function listCustomers(searchParams: string): Promise<Paginated<CustomerSummary>> {
  return apiFetch(`/customers${searchParams === '' ? '' : `?${searchParams}`}`);
}

export async function getCustomer(id: string): Promise<CustomerDetail> {
  return apiFetch(`/customers/${id}`);
}

export async function listCustomerOrders(id: string): Promise<Paginated<OrderListItem>> {
  return apiFetch(`/customers/${id}/orders`);
}

export async function createCustomer(body: CreateCustomerBody): Promise<CustomerSummary> {
  return apiFetch('/customers', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateCustomer(
  id: string,
  body: UpdateCustomerBody,
): Promise<CustomerSummary> {
  return apiFetch(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function createEquipment(
  customerId: string,
  body: CreateEquipmentBody,
): Promise<EquipmentView> {
  return apiFetch(`/customers/${customerId}/equipments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
