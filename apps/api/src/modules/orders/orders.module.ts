import { Module } from '@nestjs/common';

import { OrderTransitionsService } from './order-transitions.service';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrderTransitionsService],
  exports: [OrdersRepository],
})
export class OrdersModule {}
