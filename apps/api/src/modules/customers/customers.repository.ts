import { Injectable } from '@nestjs/common';
import type {
  CreateCustomerBody,
  CreateEquipmentBody,
  ListCustomersQuery,
  UpdateCustomerBody,
  UpdateEquipmentBody,
} from '@ofix/shared';
import type { Prisma } from '@prisma/client';

import { pageArgs } from '../../common/pagination';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TENANT_INJECTED } from '../../infra/prisma/tenant.extension';

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private searchWhere(search: string | undefined): Prisma.CustomerWhereInput {
    if (search === undefined) {
      return {};
    }
    return {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  async list(query: ListCustomersQuery) {
    const where = this.searchWhere(query.search);
    const [data, total] = await Promise.all([
      this.prisma.client.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        ...pageArgs(query),
      }),
      this.prisma.client.customer.count({ where }),
    ]);
    return { data, total };
  }

  async findById(id: string) {
    return this.prisma.client.customer.findUnique({
      where: { id },
      include: { equipments: true },
    });
  }

  async create(body: CreateCustomerBody) {
    return this.prisma.client.customer.create({
      data: { ...body, tenantId: TENANT_INJECTED },
    });
  }

  async update(id: string, body: UpdateCustomerBody) {
    return this.prisma.client.customer.update({ where: { id }, data: body });
  }

  async createEquipment(customerId: string, body: CreateEquipmentBody) {
    return this.prisma.client.equipment.create({
      data: { ...body, customerId, tenantId: TENANT_INJECTED },
    });
  }

  async findEquipmentById(id: string) {
    return this.prisma.client.equipment.findUnique({ where: { id } });
  }

  async updateEquipment(id: string, body: UpdateEquipmentBody) {
    return this.prisma.client.equipment.update({ where: { id }, data: body });
  }
}
