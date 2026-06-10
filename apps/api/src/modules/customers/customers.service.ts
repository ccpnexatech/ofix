import { Injectable, NotFoundException } from '@nestjs/common';
import {
  pageMeta,
  type CreateCustomerBody,
  type CreateEquipmentBody,
  type ListCustomersQuery,
  type ListOrdersQuery,
  type UpdateCustomerBody,
  type UpdateEquipmentBody,
} from '@ofix/shared';

import type { AuthenticatedUser } from '../../common/authenticated-user';
import { branchScopeWhere } from '../../common/branch-scope';
import { OrdersRepository } from '../orders/orders.repository';
import { CustomersRepository } from './customers.repository';

@Injectable()
export class CustomersService {
  constructor(
    private readonly repository: CustomersRepository,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  async list(query: ListCustomersQuery) {
    const { data, total } = await this.repository.list(query);
    return { data, meta: pageMeta(query, total) };
  }

  async get(id: string) {
    const customer = await this.repository.findById(id);
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return customer;
  }

  async create(body: CreateCustomerBody) {
    return this.repository.create(body);
  }

  async update(id: string, body: UpdateCustomerBody) {
    await this.get(id);
    return this.repository.update(id, body);
  }

  /** Orders of a customer, additionally branch-scoped for fixed-branch users (RN-12). */
  async listOrders(customerId: string, user: AuthenticatedUser, query: ListOrdersQuery) {
    await this.get(customerId);
    const { data, total } = await this.ordersRepository.list(query, {
      customerId,
      ...branchScopeWhere(user),
    });
    return { data, meta: pageMeta(query, total) };
  }

  async createEquipment(customerId: string, body: CreateEquipmentBody) {
    await this.get(customerId);
    return this.repository.createEquipment(customerId, body);
  }

  async updateEquipment(id: string, body: UpdateEquipmentBody) {
    const equipment = await this.repository.findEquipmentById(id);
    if (!equipment) {
      throw new NotFoundException('Equipamento não encontrado');
    }
    return this.repository.updateEquipment(id, body);
  }
}
