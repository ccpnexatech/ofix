import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  Role,
  createBranchBodySchema,
  updateBranchBodySchema,
  type BranchSummary,
  type CreateBranchBody,
  type ListBranchesResponse,
  type UpdateBranchBody,
} from '@ofix/shared';

import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
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

  /** Token of the shareable public map — feeds the "copy public link" button. */
  @Roles(Role.ADMIN, Role.TECHNICIAN, Role.ATTENDANT)
  @Get('map-token')
  async mapToken(): Promise<{ publicMapToken: string }> {
    return this.branchesService.mapToken();
  }

  /** ADR-013: branch management is ADMIN self-service. */
  @Roles(Role.ADMIN)
  @Post()
  async create(
    @Body(new ZodValidationPipe(createBranchBodySchema)) body: CreateBranchBody,
  ): Promise<BranchSummary> {
    return this.branchesService.create(body);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateBranchBodySchema)) body: UpdateBranchBody,
  ): Promise<BranchSummary> {
    return this.branchesService.update(id, body);
  }
}
