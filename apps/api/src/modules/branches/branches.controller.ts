import { Controller, Get } from '@nestjs/common';
import { Role, type ListBranchesResponse } from '@ofix/shared';

import { Roles } from '../../common/decorators/roles.decorator';
import { BranchesService } from './branches.service';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  /** Active branches of the current tenant (selectors, internal map — spec 005). */
  @Roles(Role.ADMIN, Role.TECHNICIAN, Role.ATTENDANT)
  @Get()
  async list(): Promise<ListBranchesResponse> {
    return this.branchesService.list();
  }
}
