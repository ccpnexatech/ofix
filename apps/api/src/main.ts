import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { loadEnv } from './infra/config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  configureApp(app, env.CORS_ORIGIN);
  await app.listen(env.PORT);
}

void bootstrap();
