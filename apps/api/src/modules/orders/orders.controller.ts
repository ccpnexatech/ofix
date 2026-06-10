import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  Role,
  assignTechnicianBodySchema,
  createOrderBodySchema,
  listOrdersQuerySchema,
  transitionBodySchema,
  updateOrderBodySchema,
  type AssignTechnicianBody,
  type CreateOrderBody,
  type ListOrdersQuery,
  type TransitionBody,
  type UpdateOrderBody,
} from '@ofix/shared';
import { z } from 'zod';

import type { AuthenticatedUser } from '../../common/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OrderTransitionsService } from './order-transitions.service';
import { OrdersService } from './orders.service';

const ALL_ROLES = [Role.ADMIN, Role.TECHNICIAN, Role.ATTENDANT] as const;

const warrantyReopenBodySchema = z
  .object({ reportedIssue: z.string().trim().min(5).optional() })
  .optional()
  .default({});
type WarrantyReopenBody = z.infer<typeof warrantyReopenBodySchema>;

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly transitionsService: OrderTransitionsService,
  ) {}

  @Roles(...ALL_ROLES)
  @Get()
  async list(
    @Query(new ZodValidationPipe(listOrdersQuerySchema)) query: ListOrdersQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.list(query, user);
  }

  // Matrix: create order = ADMIN and ATTENDANT.
  @Roles(Role.ADMIN, Role.ATTENDANT)
  @Post()
  async create(
    @Body(new ZodValidationPipe(createOrderBodySchema)) body: CreateOrderBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.create(body, user);
  }

  @Roles(...ALL_ROLES)
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.getDetail(id, user);
  }

  @Roles(...ALL_ROLES)
  @Get(':id/events')
  async events(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.listEvents(id, user);
  }

  // Role x field rules are enforced in the service (technician: own diagnosis only).
  @Roles(...ALL_ROLES)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateOrderBodySchema)) body: UpdateOrderBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.update(id, body, user);
  }

  // Matrix: assign technician = ADMIN and ATTENDANT.
  @Roles(Role.ADMIN, Role.ATTENDANT)
  @Post(':id/assign')
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(assignTechnicianBodySchema)) body: AssignTechnicianBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.assign(id, body, user);
  }

  // Single status-change entry point (ADR-006); per-action RBAC in the service.
  @Roles(...ALL_ROLES)
  @Post(':id/transitions')
  async transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(transitionBodySchema)) body: TransitionBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transitionsService.execute(id, body, user);
  }

  // Matrix: warranty reopen = ADMIN and ATTENDANT (RN-07).
  @Roles(Role.ADMIN, Role.ATTENDANT)
  @Post(':id/warranty-reopen')
  async warrantyReopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(warrantyReopenBodySchema)) body: WarrantyReopenBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transitionsService.reopenWarranty(id, user, body.reportedIssue);
  }
}
