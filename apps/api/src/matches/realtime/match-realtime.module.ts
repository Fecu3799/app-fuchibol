import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { MatchGateway } from './match.gateway';
import { MatchRealtimePublisher } from './match-realtime.publisher';

@Module({
  imports: [
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
  providers: [MatchGateway, MatchRealtimePublisher],
  exports: [MatchRealtimePublisher],
})
export class MatchRealtimeModule {}
