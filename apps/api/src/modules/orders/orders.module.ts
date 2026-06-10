import { Module } from '@nestjs/common';

import { OrderTransitionsService } from './order-transitions.service';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { QuoteExpirationService } from './quote-expiration.service';
import { QuoteExpirationSweep } from './quote-expiration.sweep';

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersRepository,
    OrderTransitionsService,
    QuoteExpirationService,
    QuoteExpirationSweep,
  ],
  exports: [OrdersRepository, OrdersService, OrderTransitionsService, QuoteExpirationService],
})
export class OrdersModule {}
