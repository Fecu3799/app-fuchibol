import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Actor } from '../decorators/actor.decorator';
import type { ActorPayload } from '../interfaces/actor-payload.interface';
import { RequestPasswordResetUseCase } from '../application/request-password-reset.use-case';
import { ConfirmPasswordResetUseCase } from '../application/confirm-password-reset.use-case';
import { ChangePasswordUseCase } from '../application/change-password.use-case';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth/password')
export class PasswordController {
  constructor(
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly confirmPasswordResetUseCase: ConfirmPasswordResetUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  @Post('reset/request')
  @Throttle({ login: {} })
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetRequest(
    @Body() dto: RequestPasswordResetDto,
    @Request() req: ExpressRequest,
  ) {
    await this.requestPasswordResetUseCase.execute(
      dto.email,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('reset/confirm')
  @Throttle({ login: {} })
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetConfirm(@Body() dto: ConfirmPasswordResetDto) {
    await this.confirmPasswordResetUseCase.execute(dto.token, dto.newPassword);
  }

  @Post('change')
  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @HttpCode(HttpStatus.NO_CONTENT)
  async change(@Body() dto: ChangePasswordDto, @Actor() actor: ActorPayload) {
    await this.changePasswordUseCase.execute(
      actor.userId,
      actor.sessionId,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
