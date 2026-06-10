import { Controller, Get } from '@nestjs/common';
import { APP_NAME, type HealthResponse } from '@ofix/shared';

import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: APP_NAME,
      timestamp: new Date().toISOString(),
    };
  }
}
