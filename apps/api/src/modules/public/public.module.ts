import { Module } from '@nestjs/common';

import { OrdersModule } from '../orders/orders.module';
import { PublicQuotesService } from './public-quotes.service';
import { PublicQuotesController } from './public.controller';

@Module({
  imports: [OrdersModule],
  controllers: [PublicQuotesController],
  providers: [PublicQuotesService],
})
export class PublicModule {}
