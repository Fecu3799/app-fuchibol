import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

@Injectable()
export class MatchRealtimePublisher {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  notifyMatchUpdated(matchId: string, revision: number): void {
    if (!this.server) return;
    this.server
      .to(`match:${matchId}`)
      .emit('match.updated', { matchId, revision });
  }
}
