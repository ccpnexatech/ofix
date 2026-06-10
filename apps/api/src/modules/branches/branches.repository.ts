import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service';

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
}
