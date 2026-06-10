import { Module } from '@nestjs/common';

import { OrdersModule } from '../orders/orders.module';
import { OrderQuotesController, QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [OrdersModule],
  controllers: [OrderQuotesController, QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
