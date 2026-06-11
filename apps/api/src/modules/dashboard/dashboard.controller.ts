import { Controller, Get, Query } from '@nestjs/common';
import {
  Role,
  dashboardQuerySchema,
  revenueByMonthQuerySchema,
  type DashboardQuery,
  type RevenueByMonthQuery,
} from '@ofix/shared';

import type { AuthenticatedUser } from '../../common/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DashboardService } from './dashboard.service';

// Matrix (spec 004): ADMIN/ATTENDANT see aggregates (branch-scoped per RN-14);
// TECHNICIAN gets the same endpoints restricted to their own orders.
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles(Role.ADMIN, Role.ATTENDANT, Role.TECHNICIAN)
  @Get('summary')
  async summary(
    @Query(new ZodValidationPipe(dashboardQuerySchema)) query: DashboardQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.summary(user, query);
  }

  @Roles(Role.ADMIN, Role.ATTENDANT, Role.TECHNICIAN)
  @Get('orders-by-status')
  async ordersByStatus(
    @Query(new ZodValidationPipe(dashboardQuerySchema)) query: DashboardQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.ordersByStatus(user, query.branchId);
  }

  @Roles(Role.ADMIN, Role.ATTENDANT, Role.TECHNICIAN)
  @Get('revenue-by-month')
  async revenueByMonth(
    @Query(new ZodValidationPipe(revenueByMonthQuerySchema)) query: RevenueByMonthQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.revenueByMonth(user, query);
  }

  @Roles(Role.ADMIN)
  @Get('branches-comparison')
  async branchesComparison(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.branchesComparison(user);
  }
}
