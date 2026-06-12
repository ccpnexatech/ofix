import { Injectable } from '@nestjs/common';
import type { CreateBranchBody, UpdateBranchBody } from '@ofix/shared';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { TENANT_INJECTED } from '../../infra/prisma/tenant.extension';

@Injectable()
export class BranchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Tenant scope is injected by the Prisma extension (request context). */
  async findActive() {
    return this.prisma.client.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.client.branch.findUnique({ where: { id } });
  }

  async findByName(name: string) {
    return this.prisma.client.branch.findFirst({ where: { name } });
  }

  async create(data: CreateBranchBody) {
    return this.prisma.client.branch.create({ data: { tenantId: TENANT_INJECTED, ...data } });
  }

  async update(id: string, data: UpdateBranchBody) {
    return this.prisma.client.branch.update({ where: { id }, data });
  }
}
