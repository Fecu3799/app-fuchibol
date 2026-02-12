import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DevAuthMiddleware } from './infra/auth/dev-auth.middleware';
import { PrismaModule } from './infra/prisma/prisma.module';
import { MatchesModule } from './matches/matches.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MatchesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
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
