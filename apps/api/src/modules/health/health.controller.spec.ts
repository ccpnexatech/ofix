import { Test } from '@nestjs/testing';
import { healthResponseSchema } from '@ofix/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('returns a payload matching the shared health schema', () => {
    const result = controller.check();

    expect(healthResponseSchema.parse(result)).toEqual(result);
    expect(result.service).toBe('OFIX');
  });
});
