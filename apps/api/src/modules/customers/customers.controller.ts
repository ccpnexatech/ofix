import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  Role,
  createCustomerBodySchema,
  createEquipmentBodySchema,
  listCustomersQuerySchema,
  listOrdersQuerySchema,
  updateCustomerBodySchema,
  updateEquipmentBodySchema,
  type CreateCustomerBody,
  type CreateEquipmentBody,
  type ListCustomersQuery,
  type ListOrdersQuery,
  type UpdateCustomerBody,
  type UpdateEquipmentBody,
} from '@ofix/shared';

import type { AuthenticatedUser } from '../../common/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CustomersService } from './customers.service';

const ALL_ROLES = [Role.ADMIN, Role.TECHNICIAN, Role.ATTENDANT] as const;

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Roles(...ALL_ROLES)
  @Get()
  async list(@Query(new ZodValidationPipe(listCustomersQuerySchema)) query: ListCustomersQuery) {
    return this.customersService.list(query);
  }

  // Permission matrix (spec 004): create customer = ADMIN and ATTENDANT.
  @Roles(Role.ADMIN, Role.ATTENDANT)
  @Post()
  async create(@Body(new ZodValidationPipe(createCustomerBodySchema)) body: CreateCustomerBody) {
    return this.customersService.create(body);
  }

  @Roles(...ALL_ROLES)
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.get(id);
  }

  @Roles(Role.ADMIN, Role.ATTENDANT)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCustomerBodySchema)) body: UpdateCustomerBody,
  ) {
    return this.customersService.update(id, body);
  }

  @Roles(...ALL_ROLES)
  @Get(':id/orders')
  async listOrders(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listOrdersQuerySchema)) query: ListOrdersQuery,
  ) {
    return this.customersService.listOrders(id, user, query);
  }

  @Roles(Role.ADMIN, Role.ATTENDANT)
  @Post(':id/equipments')
  async createEquipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createEquipmentBodySchema)) body: CreateEquipmentBody,
  ) {
    return this.customersService.createEquipment(id, body);
  }
}

@Controller('equipments')
export class EquipmentsController {
  constructor(private readonly customersService: CustomersService) {}

  @Roles(Role.ADMIN, Role.ATTENDANT)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateEquipmentBodySchema)) body: UpdateEquipmentBody,
  ) {
    return this.customersService.updateEquipment(id, body);
  }
}
