import { Injectable } from '@nestjs/common';
import type { ListBranchesResponse } from '@ofix/shared';

import { BranchesRepository } from './branches.repository';

@Injectable()
export class BranchesService {
  constructor(private readonly repository: BranchesRepository) {}

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
