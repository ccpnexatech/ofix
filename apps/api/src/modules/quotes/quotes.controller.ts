import { Body, Controller, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  Role,
  updateQuoteItemsBodySchema,
  type UpdateQuoteItemsBody,
} from '@ofix/shared';

import type { AuthenticatedUser } from '../../common/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { QuotesService } from './quotes.service';

// Matrix (spec 004): quote handling = ADMIN or assigned TECHNICIAN (checked
// per-order in the service).
@Controller('orders')
export class OrderQuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Post(':id/quotes')
  async create(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quotesService.createVersion(id, user);
  }
}

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Patch(':id')
  async updateItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateQuoteItemsBodySchema)) body: UpdateQuoteItemsBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.updateItems(id, body, user);
  }

  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @Post(':id/send')
  async send(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quotesService.send(id, user);
  }
}
