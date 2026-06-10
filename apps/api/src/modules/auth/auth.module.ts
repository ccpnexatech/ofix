import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { loadEnv } from '../../infra/config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true, // guards anywhere in the app inject JwtService
      useFactory: () => ({
        secret: loadEnv().JWT_SECRET,
        signOptions: { expiresIn: '15m' }, // short-lived access token (ADR-008)
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
