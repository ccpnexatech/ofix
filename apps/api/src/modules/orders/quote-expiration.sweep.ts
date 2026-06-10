import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { QuoteExpirationService } from './quote-expiration.service';

/** RN-05: "varredura no boot do dia" — runs at boot and daily at 03:00. */
@Injectable()
export class QuoteExpirationSweep implements OnApplicationBootstrap {
  constructor(private readonly expiration: QuoteExpirationService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.expiration.sweep();
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async daily(): Promise<void> {
    await this.expiration.sweep();
  }
}
