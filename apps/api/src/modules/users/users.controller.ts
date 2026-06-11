import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  Role,
  createUserBodySchema,
  listUsersQuerySchema,
  updateUserBodySchema,
  type CreateUserBody,
  type ListUsersQuery,
  type UpdateUserBody,
} from '@ofix/shared';

import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';

// Matrix (spec 004): user MANAGEMENT (create/update) is ADMIN-only. Listing is
// also open to ATTENDANT: assigning a technician (matrix: ✓) needs the names.
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.ADMIN, Role.ATTENDANT)
  @Get()
  async list(@Query(new ZodValidationPipe(listUsersQuerySchema)) query: ListUsersQuery) {
    return this.usersService.list(query);
  }

  @Roles(Role.ADMIN)
  @Post()
  async create(@Body(new ZodValidationPipe(createUserBodySchema)) body: CreateUserBody) {
    return this.usersService.create(body);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateUserBodySchema)) body: UpdateUserBody,
  ) {
    return this.usersService.update(id, body);
  }
}
