import { Module } from '@nestjs/common';

import { OrdersModule } from '../orders/orders.module';
import { PublicMapService } from './public-map.service';
import { PublicQuotesService } from './public-quotes.service';
import { PublicMapController, PublicQuotesController } from './public.controller';

@Module({
  imports: [OrdersModule],
  controllers: [PublicQuotesController, PublicMapController],
  providers: [PublicQuotesService, PublicMapService],
})
export class PublicModule {}
