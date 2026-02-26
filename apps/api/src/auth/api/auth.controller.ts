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
import { RegisterUseCase } from '../application/register.use-case';
import { LoginUseCase } from '../application/login.use-case';
import { RefreshUseCase } from '../application/refresh.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { LogoutAllUseCase } from '../application/logout-all.use-case';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Actor } from '../decorators/actor.decorator';
import type { ActorPayload } from '../interfaces/actor-payload.interface';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllUseCase: LogoutAllUseCase,
  ) {}

  @Post('register')
  @Throttle({ mutations: {} })
  async register(@Body() dto: RegisterDto) {
    return this.registerUseCase.execute(dto);
  }

  @Post('login')
  @Throttle({ login: {} })
  async login(@Body() dto: LoginDto, @Request() req: ExpressRequest) {
    return this.loginUseCase.execute({
      identifier: dto.identifier,
      password: dto.password,
      device: dto.device,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('refresh')
  @Throttle({ login: {} })
  async refresh(@Body() dto: RefreshDto) {
    return this.refreshUseCase.execute(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Actor() actor: ActorPayload) {
    if (actor.sessionId) {
      await this.logoutUseCase.execute(actor.sessionId, actor.userId);
    }
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@Actor() actor: ActorPayload) {
    await this.logoutAllUseCase.execute(actor.userId);
  }
}
