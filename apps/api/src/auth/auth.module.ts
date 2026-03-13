import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { StorageModule } from '../infra/storage/storage.module';
import { PrepareAvatarUseCase } from './application/profile/prepare-avatar.use-case';
import { ConfirmAvatarUseCase } from './application/profile/confirm-avatar.use-case';
import { AuthController } from './api/auth.controller';
import { MeController } from './api/me.controller';
import { SessionsController } from './api/sessions.controller';
import { EmailVerifyController } from './api/email-verify.controller';
import { PasswordController } from './api/password.controller';
import { RegisterUseCase } from './application/profile/register.use-case';
import { LoginUseCase } from './application/sessions/login.use-case';
import { GetMeUseCase } from './application/profile/get-me.use-case';
import { UpdateMeUseCase } from './application/profile/update-me.use-case';
import { RefreshUseCase } from './application/sessions/refresh.use-case';
import { LogoutUseCase } from './application/sessions/logout.use-case';
import { LogoutAllUseCase } from './application/sessions/logout-all.use-case';
import { ListSessionsQuery } from './application/sessions/list-sessions.query';
import { RevokeSessionCommand } from './application/sessions/revoke-session.command';
import { RequestEmailVerifyUseCase } from './application/email/request-email-verify.use-case';
import { ConfirmEmailVerifyUseCase } from './application/email/confirm-email-verify.use-case';
import { RequestPasswordResetUseCase } from './application/password/request-password-reset.use-case';
import { ConfirmPasswordResetUseCase } from './application/password/confirm-password-reset.use-case';
import { ChangePasswordUseCase } from './application/password/change-password.use-case';
import { JwtStrategy } from './infra/jwt.strategy';
import { TokenService } from './infra/token.service';
import { EmailService, DevEmailService } from './infra/email.service';
import { AuthAuditService } from './infra/auth-audit.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<StringValue>('JWT_EXPIRES_IN', '15m'),
        },
      }),
    }),
  ],
  controllers: [
    AuthController,
    MeController,
    SessionsController,
    EmailVerifyController,
    PasswordController,
  ],
  providers: [
    RegisterUseCase,
    LoginUseCase,
    GetMeUseCase,
    UpdateMeUseCase,
    RefreshUseCase,
    LogoutUseCase,
    LogoutAllUseCase,
    ListSessionsQuery,
    RevokeSessionCommand,
    RequestEmailVerifyUseCase,
    ConfirmEmailVerifyUseCase,
    RequestPasswordResetUseCase,
    ConfirmPasswordResetUseCase,
    ChangePasswordUseCase,
    PrepareAvatarUseCase,
    ConfirmAvatarUseCase,
    JwtStrategy,
    TokenService,
    AuthAuditService,
    { provide: EmailService, useClass: DevEmailService },
  ],
  exports: [JwtStrategy],
})
export class AuthModule {}
