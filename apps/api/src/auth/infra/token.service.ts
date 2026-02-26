import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

export interface RefreshTokenParts {
  sessionId: string;
  secret: string;
}

@Injectable()
export class TokenService {
  /** Generate a new refresh token in format "sessionId.secret" */
  generateRefreshToken(sessionId: string): { token: string; secret: string } {
    const secret = crypto.randomBytes(32).toString('base64url');
    return { token: `${sessionId}.${secret}`, secret };
  }

  /** Parse "sessionId.secret" → { sessionId, secret }. Returns null if malformed. */
  parseRefreshToken(token: string): RefreshTokenParts | null {
    const dotIndex = token.indexOf('.');
    if (dotIndex < 1) return null;
    const sessionId = token.slice(0, dotIndex);
    const secret = token.slice(dotIndex + 1);
    if (!sessionId || !secret) return null;
    return { sessionId, secret };
  }

  async hashSecret(secret: string): Promise<string> {
    return argon2.hash(secret);
  }

  async verifySecret(hash: string, secret: string): Promise<boolean> {
    return argon2.verify(hash, secret);
  }

  /** For email tokens: sha256 hex of raw token (deterministic — enables lookup by hash) */
  hashEmailToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateEmailToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
