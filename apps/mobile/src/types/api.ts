// ── Auth ──

export interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; role: string };
}

export interface MeResponse {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

// ── Matches ──

export interface MatchHomeItem {
  id: string;
  title: string;
  startsAt: string;
  location: string | null;
  capacity: number;
  status: string;
  revision: number;
  isLocked: boolean;
  lockedAt: string | null;
  confirmedCount: number;
  myStatus: string | null;
  isMatchAdmin: boolean;
  updatedAt: string;
}

export interface PageInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ListMatchesResponse {
  items: MatchHomeItem[];
  pageInfo: PageInfo;
}

export interface ParticipantView {
  userId: string;
  status: string;
  waitlistPosition: number | null;
}

export interface MatchSnapshot {
  id: string;
  title: string;
  startsAt: string;
  location: string | null;
  capacity: number;
  status: string;
  revision: number;
  isLocked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  createdById: string;
  confirmedCount: number;
  participants: ParticipantView[];
  waitlist: ParticipantView[];
  myStatus: string | null;
  actionsAllowed: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GetMatchResponse {
  match: MatchSnapshot;
}

export interface CreateMatchResponse {
  id: string;
  revision: number;
  status: string;
}

export interface ApiErrorBody {
  type?: string;
  title?: string;
  status: number;
  code?: string;
  detail?: string;
  errors?: unknown;
  requestId?: string;
  // Legacy compat (NestJS default shape)
  statusCode?: number;
  message?: string;
  error?: string;
}
