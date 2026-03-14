import { ConsoleLogger } from '@nestjs/common';

const SERVICE_NAME = 'api';

/**
 * AppLogger — logger central de la aplicación.
 *
 * Dev  (NODE_ENV !== 'production'): delega a ConsoleLogger de NestJS (pretty, coloreado).
 * Prod (NODE_ENV === 'production') : emite JSON lines a stdout para ingestión por log aggregators.
 *
 * Campos globales añadidos automáticamente en prod:
 *   level, ts, service, env, source
 *
 * Uso desde servicios/use-cases:
 *   private readonly logger = new Logger(MyService.name);
 *   this.logger.log('mensaje simple');
 *   this.logger.log({ msg: 'match canceled', op: 'cancelMatch', matchId, actorUserId });
 *
 * El interceptor y el exception filter pasan objetos estructurados para que los
 * campos queden como top-level keys en el JSON (no anidados en "msg").
 *
 * Ejemplo de log HTTP en producción:
 * {
 *   "level":"log", "ts":"2026-03-14T02:00:00Z",
 *   "service":"api", "env":"production", "source":"HTTP",
 *   "method":"GET", "path":"/api/v1/matches", "status":200, "ms":23,
 *   "rid":"abc123", "actorUserId":"u_42"
 * }
 */
export class AppLogger extends ConsoleLogger {
  private readonly isProd = process.env.NODE_ENV === 'production';
  private readonly env = process.env.NODE_ENV ?? 'development';

  override log(message: unknown, context?: string): void {
    if (this.isProd) {
      this.emit('log', message, context);
      return;
    }
    super.log(this.toDevString(message), context ?? this.context);
  }

  override warn(message: unknown, context?: string): void {
    if (this.isProd) {
      this.emit('warn', message, context);
      return;
    }
    super.warn(this.toDevString(message), context ?? this.context);
  }

  override error(message: unknown, stack?: string, context?: string): void {
    if (this.isProd) {
      this.emit('error', message, context, stack);
      return;
    }
    super.error(this.toDevString(message), stack, context ?? this.context);
  }

  override debug(message: unknown, context?: string): void {
    if (this.isProd) {
      this.emit('debug', message, context);
      return;
    }
    super.debug(this.toDevString(message), context ?? this.context);
  }

  override verbose(message: unknown, context?: string): void {
    if (this.isProd) {
      this.emit('verbose', message, context);
      return;
    }
    super.verbose(this.toDevString(message), context ?? this.context);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * En dev serializa objetos a JSON en una línea para que ConsoleLogger los coloree legibles.
   */
  private toDevString(message: unknown): unknown {
    if (typeof message === 'object' && message !== null) {
      return JSON.stringify(message);
    }
    return message;
  }

  /**
   * Emite una línea JSON a stdout.
   * Campos base: level, ts, service, env, source.
   * Si message es un objeto, sus campos se despliegan como top-level keys.
   * Si es string, va como campo "msg".
   */
  private emit(
    level: string,
    message: unknown,
    context?: string,
    stack?: string,
  ): void {
    const entry: Record<string, unknown> = {
      level,
      ts: new Date().toISOString(),
      service: SERVICE_NAME,
      env: this.env,
      source: context ?? this.context ?? 'App',
    };

    if (typeof message === 'object' && message !== null) {
      Object.assign(entry, message);
    } else {
      entry.msg = message;
    }

    if (stack) entry.stack = stack;

    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}
