import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';

@Module({
  imports: [PrismaModule],
  providers: [IdempotencyService, IdempotencyCleanupService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
