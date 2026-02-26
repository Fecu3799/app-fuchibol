declare namespace Express {
  interface Request {
    user?: {
      userId: string;
      role: string;
      sessionId?: string;
    };
    requestId?: string;
  }
}
