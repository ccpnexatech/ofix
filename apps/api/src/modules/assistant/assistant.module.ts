import { Module } from '@nestjs/common';

import { loadEnv } from '../../infra/config/env';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AssistantToolsService } from './assistant-tools.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { LocalAssistantModel } from './local-model';
import { AnthropicModelClient, AssistantModelClient } from './model-client';

@Module({
  imports: [DashboardModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantToolsService,
    {
      // ADR-012: deterministic local responder by default; the paid provider
      // is one env var away (ASSISTANT_MODE=anthropic).
      provide: AssistantModelClient,
      useFactory: (): AssistantModelClient =>
        loadEnv().ASSISTANT_MODE === 'anthropic'
          ? new AnthropicModelClient()
          : new LocalAssistantModel(),
    },
  ],
})
export class AssistantModule {}
