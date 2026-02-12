import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { AuthController } from './api/auth.controller';
import { MeController } from './api/me.controller';
import { RegisterUseCase } from './application/register.use-case';
import { LoginUseCase } from './application/login.use-case';
import { GetMeUseCase } from './application/get-me.use-case';
import { JwtStrategy } from './infra/jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<StringValue>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [RegisterUseCase, LoginUseCase, GetMeUseCase, JwtStrategy],
  exports: [JwtStrategy],
})
export class AuthModule {}
