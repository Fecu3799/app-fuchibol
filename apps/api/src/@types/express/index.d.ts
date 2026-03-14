declare namespace Express {
  interface Request {
    user?: {
      userId: string;
      role: string;
      sessionId?: string;
    };
    requestId?: string;
    /** Unix timestamp (ms) set by requestIdMiddleware. Used for request duration logging. */
    startTime?: number;
  }
}
