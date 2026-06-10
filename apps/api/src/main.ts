import { NestFactory } from '@nestjs/core';
import { API_PREFIX } from '@ofix/shared';
import { AppModule } from './app.module';
import { loadEnv } from './infra/config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_PREFIX);
  await app.listen(env.PORT);
}

void bootstrap();
