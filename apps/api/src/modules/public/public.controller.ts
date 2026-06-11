import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { publicRejectBodySchema, type PublicRejectBody } from '@ofix/shared';

import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PublicMapService } from './public-map.service';
import { PublicQuotesService } from './public-quotes.service';

// Spec 003: /public/* is rate limited at 20 req/min/IP.
@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('public/quotes')
export class PublicQuotesController {
  constructor(private readonly publicQuotes: PublicQuotesService) {}

  @Get(':token')
  async view(@Param('token') token: string) {
    return this.publicQuotes.view(token);
  }

  @Post(':token/approve')
  @HttpCode(200)
  async approve(@Param('token') token: string) {
    return this.publicQuotes.approve(token);
  }

  @Post(':token/reject')
  @HttpCode(200)
  async reject(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(publicRejectBodySchema)) body: PublicRejectBody,
  ) {
    return this.publicQuotes.reject(token, body.reason);
  }
}

@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('public/map')
export class PublicMapController {
  constructor(private readonly publicMap: PublicMapService) {}

  /** RN-15: shareable branches map. */
  @Get(':mapToken')
  async view(@Param('mapToken') mapToken: string) {
    return this.publicMap.view(mapToken);
  }
}
