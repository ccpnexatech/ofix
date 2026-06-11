import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import {
  Role,
  assistantChatBodySchema,
  dashboardInsightsBodySchema,
  type AssistantChatBody,
  type DashboardInsightsBody,
} from '@ofix/shared';
import type { Response } from 'express';

import type { AuthenticatedUser } from '../../common/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AssistantService } from './assistant.service';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  /** Streaming SSE chat (spec 010). */
  @Roles(Role.ADMIN, Role.TECHNICIAN, Role.ATTENDANT)
  @Post('chat')
  @HttpCode(200)
  async chat(
    @Body(new ZodValidationPipe(assistantChatBodySchema)) body: AssistantChatBody,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    // Errors before the stream opens (429/503) keep normal JSON semantics.
    this.assistantService.precheck(user);
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      await this.assistantService.chat(user, body, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });
    } finally {
      res.end();
    }
  }

  @Roles(Role.ADMIN, Role.TECHNICIAN, Role.ATTENDANT)
  @Post('dashboard-insights')
  async insights(
    @Body(new ZodValidationPipe(dashboardInsightsBodySchema)) body: DashboardInsightsBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assistantService.insights(user, body);
  }
}
