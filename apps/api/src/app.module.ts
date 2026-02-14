import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { DevAuthMiddleware } from './infra/auth/dev-auth.middleware';
import { PrismaModule } from './infra/prisma/prisma.module';
import { AppThrottleModule } from './common/throttle/throttle.module';
import { MatchesModule } from './matches/matches.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AppThrottleModule,
    AuthModule,
    UsersModule,
    MatchesModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule implements NestModule {
  constructor(private readonly config: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    const isDev = this.config.get('NODE_ENV') !== 'production';
    if (isDev) {
      consumer.apply(DevAuthMiddleware).forRoutes('*');
    }
  }
}
