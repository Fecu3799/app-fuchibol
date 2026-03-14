import { HttpStatus, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger/app-logger.service';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { MetricsService } from './metrics/metrics.service';

async function bootstrap() {
  const logger = new AppLogger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(logger);

  // --- Helmet (security headers) ---
  app.use(helmet());

  // --- CORS per environment ---
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [];

  app.enableCors({
    origin: isProd ? allowedOrigins : true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'If-Match',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    credentials: true,
  });

  // --- Body size limit ---
  app.useBodyParser('json', { limit: '1mb' });

  app.use(requestIdMiddleware);

  // Health endpoints excluded from global prefix so load balancers
  // can reach /health/live and /health/ready without auth or prefix.
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );
  const metricsService = app.get(MetricsService);
  app.useGlobalInterceptors(new HttpLoggingInterceptor(metricsService));
  app.useGlobalFilters(new ApiExceptionFilter(metricsService));

  const port = process.env.PORT ?? 3000;
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);

  logger.log({ msg: 'API started', port, host });
}
void bootstrap();
