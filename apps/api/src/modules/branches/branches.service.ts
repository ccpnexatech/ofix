import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  BranchSummary,
  CreateBranchBody,
  ListBranchesResponse,
  UpdateBranchBody,
} from '@ofix/shared';
import type { Branch } from '@prisma/client';

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
    return branches.map((branch) => this.toSummary(branch));
  }

  /** ADR-013: branch creation is ADMIN self-service; name is unique per tenant. */
  async create(body: CreateBranchBody): Promise<BranchSummary> {
    const existing = await this.repository.findByName(body.name);
    if (existing) {
      throw new ConflictException('Já existe uma filial com esse nome');
    }
    const branch = await this.repository.create(body);
    return this.toSummary(branch);
  }

  async update(id: string, body: UpdateBranchBody): Promise<BranchSummary> {
    const branch = await this.repository.findById(id);
    if (!branch) {
      throw new NotFoundException('Filial não encontrada');
    }
    if (body.name !== undefined && body.name !== branch.name) {
      const duplicate = await this.repository.findByName(body.name);
      if (duplicate) {
        throw new ConflictException('Já existe uma filial com esse nome');
      }
    }
    const updated = await this.repository.update(id, body);
    return this.toSummary(updated);
  }

  private toSummary(branch: Branch): BranchSummary {
    return {
      id: branch.id,
      name: branch.name,
      phone: branch.phone,
      address: branch.address,
      city: branch.city,
      state: branch.state,
      zipCode: branch.zipCode,
      latitude: branch.latitude?.toString() ?? null,
      longitude: branch.longitude?.toString() ?? null,
    };
  }
}
