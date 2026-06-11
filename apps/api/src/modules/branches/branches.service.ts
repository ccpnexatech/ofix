import { Injectable } from '@nestjs/common';
import type { ListBranchesResponse } from '@ofix/shared';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { currentTenantId } from '../../infra/prisma/tenant-context';
import { BranchesRepository } from './branches.repository';

@Injectable()
export class BranchesService {
  constructor(
    private readonly repository: BranchesRepository,
    private readonly prisma: PrismaService,
  ) {}

  async mapToken(): Promise<{ publicMapToken: string }> {
    // Tenant is not a tenant-scoped model; resolve it from the request context.
    const tenant = await this.prisma.unscoped.tenant.findUniqueOrThrow({
      where: { id: currentTenantId() ?? '' },
      select: { publicMapToken: true },
    });
    return tenant;
  }

  async list(): Promise<ListBranchesResponse> {
    const branches = await this.repository.findActive();
    return branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      phone: branch.phone,
      address: branch.address,
      city: branch.city,
      state: branch.state,
      zipCode: branch.zipCode,
      latitude: branch.latitude?.toString() ?? null,
      longitude: branch.longitude?.toString() ?? null,
    }));
  }
}
