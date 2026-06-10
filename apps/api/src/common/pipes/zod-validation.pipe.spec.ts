import { BadRequestException } from '@nestjs/common';
import { loginBodySchema } from '@ofix/shared';
import { describe, expect, it } from 'vitest';

import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe (login schema)', () => {
  const pipe = new ZodValidationPipe(loginBodySchema);

  it('returns parsed and normalized data', () => {
    const result = pipe.transform({ email: 'USER@Test.DEV', password: 'long-enough-pass' });
    expect(result.email).toBe('user@test.dev');
  });

  it('rejects passwords shorter than 8 chars (spec 003)', () => {
    expect(() => pipe.transform({ email: 'user@test.dev', password: '1234567' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects invalid e-mails', () => {
    expect(() => pipe.transform({ email: 'not-an-email', password: 'long-enough-pass' })).toThrow(
      BadRequestException,
    );
  });
});
