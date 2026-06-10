import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { z, type ZodType } from 'zod';

/**
 * Validates request payloads against a shared Zod schema (spec 001: schemas in
 * @ofix/shared are the single source of truth). Returns the parsed (and
 * transformed) value, so handlers receive typed, normalized data.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Dados inválidos',
        details: z.treeifyError(result.error),
      });
    }
    return result.data;
  }
}
