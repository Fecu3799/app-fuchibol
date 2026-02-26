import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Actor } from '../../auth/decorators/actor.decorator';
import type { ActorPayload } from '../../auth/interfaces/actor-payload.interface';
import { RegisterDeviceUseCase } from '../application/register-device.use-case';
import { PushService } from '../application/push.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { TestPushDto } from './dto/test-push.dto';

@Controller('push')
export class PushController {
  constructor(
    private readonly registerDeviceUseCase: RegisterDeviceUseCase,
    private readonly pushService: PushService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('devices/register')
  async register(
    @Body() body: RegisterDeviceDto,
    @Actor() actor: ActorPayload,
  ) {
    return this.registerDeviceUseCase.execute({
      userId: actor.userId,
      expoPushToken: body.expoPushToken,
      platform: body.platform,
      deviceName: body.deviceName,
    });
  }

  /**
   * DEV/ADMIN ONLY — sends a test push to all active devices of the authenticated user.
   * Use to verify end-to-end delivery before wiring domain events.
   */
  @UseGuards(JwtAuthGuard)
  @Post('test')
  async testPush(@Body() body: TestPushDto, @Actor() actor: ActorPayload) {
    const isDev = this.config.get<string>('NODE_ENV') !== 'production';
    const isAdmin = actor.role === 'ADMIN';

    if (!isDev && !isAdmin) {
      throw new ForbiddenException('DEV_ONLY');
    }

    const tokens = await this.pushService.getActiveTokensForUser(actor.userId);

    const results = await Promise.allSettled(
      tokens.map((token) =>
        this.pushService.sendExpoPush({
          toToken: token,
          title: body.title,
          body: body.body,
          data: body.matchId ? { matchId: body.matchId } : {},
        }),
      ),
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => String(r.reason));

    return { sent, total: tokens.length, errors };
  }
}
