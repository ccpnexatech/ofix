import { Module } from '@nestjs/common';

import { DashboardModule } from '../dashboard/dashboard.module';
import { AssistantToolsService } from './assistant-tools.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantModelClient } from './model-client';

@Module({
  imports: [DashboardModule],
  controllers: [AssistantController],
  providers: [AssistantService, AssistantToolsService, AssistantModelClient],
})
export class AssistantModule {}
