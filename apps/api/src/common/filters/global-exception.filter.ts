import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

import { InvalidTransitionError, WarrantyReopenError } from '../errors/domain.errors';
import { TenantIsolationError } from '../errors/tenant-isolation.error';

interface StandardError {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
}

/**
 * Normalizes every error to the standard shape (spec 001):
 * { statusCode, error, message, details? }. Domain errors map to 422 with the
 * RN code in details; unknown errors become an opaque 500 (and are logged).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toStandardError(exception);
    response.status(body.statusCode).json(body);
  }

  private toStandardError(exception: unknown): StandardError {
    if (exception instanceof InvalidTransitionError || exception instanceof WarrantyReopenError) {
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'Unprocessable Entity',
        message: exception.message,
        details: exception.code === undefined ? undefined : { code: exception.code },
      };
    }

    if (exception instanceof TenantIsolationError) {
      // Programming error: never expose internals, always log loudly.
      this.logger.error(exception.message, exception.stack);
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Erro interno',
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return { statusCode: status, error: exception.name, message: payload };
      }
      const record = payload as Record<string, unknown>;
      const message = record.message;
      let normalizedMessage: string;
      if (typeof message === 'string') {
        normalizedMessage = message;
      } else if (Array.isArray(message)) {
        normalizedMessage = message.join('; ');
      } else {
        normalizedMessage = exception.message;
      }
      return {
        statusCode: status,
        error: typeof record.error === 'string' ? record.error : exception.name,
        message: normalizedMessage,
        details:
          record.details ?? (typeof record.code === 'string' ? { code: record.code } : undefined),
      };
    }

    const detail = exception instanceof Error ? exception.stack : String(exception);
    this.logger.error('Unhandled exception', detail);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Erro interno',
    };
  }
}
