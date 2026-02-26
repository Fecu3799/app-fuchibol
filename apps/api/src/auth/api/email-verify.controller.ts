import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RequestEmailVerifyUseCase } from '../application/request-email-verify.use-case';
import { ConfirmEmailVerifyUseCase } from '../application/confirm-email-verify.use-case';
import { RequestEmailVerifyDto } from './dto/request-email-verify.dto';
import { ConfirmEmailVerifyDto } from './dto/confirm-email-verify.dto';

@Controller('auth/email')
export class EmailVerifyController {
  constructor(
    private readonly requestEmailVerifyUseCase: RequestEmailVerifyUseCase,
    private readonly confirmEmailVerifyUseCase: ConfirmEmailVerifyUseCase,
  ) {}

  @Post('verify/request')
  @Throttle({ login: {} })
  @HttpCode(HttpStatus.NO_CONTENT)
  async request(@Body() dto: RequestEmailVerifyDto) {
    await this.requestEmailVerifyUseCase.execute(dto.email);
  }

  @Post('verify/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirm(@Body() dto: ConfirmEmailVerifyDto) {
    await this.confirmEmailVerifyUseCase.execute(dto.token);
  }
}
