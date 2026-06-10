import { Controller, Get } from '@nestjs/common';
import { APP_NAME, type HealthResponse } from '@ofix/shared';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: APP_NAME,
      timestamp: new Date().toISOString(),
    };
  }
}
