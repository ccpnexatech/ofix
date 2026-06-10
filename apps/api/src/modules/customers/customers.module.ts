import { Module } from '@nestjs/common';

import { OrdersModule } from '../orders/orders.module';
import { CustomersController, EquipmentsController } from './customers.controller';
import { CustomersRepository } from './customers.repository';
import { CustomersService } from './customers.service';

@Module({
  imports: [OrdersModule],
  controllers: [CustomersController, EquipmentsController],
  providers: [CustomersService, CustomersRepository],
})
export class CustomersModule {}
