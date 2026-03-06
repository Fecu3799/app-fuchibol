// ── Auth ──

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: { id: string; email: string; role: string };
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse {
  message: string;
  user: { id: string; email: string; username: string };
}

export type UserGender = 'MALE' | 'FEMALE' | 'OTHER';
export type PreferredPosition = 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD';
export type SkillLevel = 'BEGINNER' | 'AMATEUR' | 'REGULAR' | 'SEMIPRO' | 'PRO';

export interface MeResponse {
  id: string;
  email: string;
  username?: string;
  role: string;
  gender?: UserGender | null;
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  preferredPosition?: PreferredPosition | null;
  skillLevel?: SkillLevel | null;
  termsAcceptedAt?: string;
  reliabilityScore: number;
  reliabilityLabel: string;
  suspendedUntil?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface PrepareAvatarResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

export interface ConfirmAvatarResponse {
  avatarUrl: string;
}

// ── Matches ──

export interface MatchHomeItem {
  id: string;
  title: string;
  startsAt: string;
  location: string | null;
  capacity: number;
  status: string;
  matchStatus: 'UPCOMING' | 'PLAYED' | 'CANCELLED';
  matchGender: 'SIN_DEFINIR' | 'MASCULINO' | 'FEMENINO' | 'MIXTO';
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
  username: string;
  status: string;
  waitlistPosition: number | null;
  isMatchAdmin: boolean;
}

export interface SpectatorView {
  userId: string;
  username: string;
}

export interface MatchSnapshot {
  id: string;
  title: string;
  startsAt: string;
  location: string | null;
  capacity: number;
  status: string;
  matchStatus: 'UPCOMING' | 'PLAYED' | 'CANCELLED';
  matchGender: 'SIN_DEFINIR' | 'MASCULINO' | 'FEMENINO' | 'MIXTO';
  revision: number;
  isLocked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  createdById: string;
  confirmedCount: number;
  participants: ParticipantView[];
  waitlist: ParticipantView[];
  spectators: SpectatorView[];
  spectatorCount: number;
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

// ── Groups ──

export interface GroupSummary {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
  createdAt: string;
}

export interface ListGroupsResponse {
  owned: GroupSummary[];
  memberOf: GroupSummary[];
}

export interface GroupMember {
  userId: string;
  username: string;
  createdAt: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
  members: GroupMember[];
  createdAt: string;
}

export interface CreateGroupResponse {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

// ── Invite Candidates ──

export type InviteCandidateStatus =
  | 'CONFIRMED'
  | 'INVITED'
  | 'WAITLISTED'
  | 'SPECTATOR'
  | 'NONE';

export interface InviteCandidate {
  userId: string;
  username: string;
  matchStatus: InviteCandidateStatus;
  canInvite: boolean;
  reason?: string;
}

export interface GetInviteCandidatesResponse {
  candidates: InviteCandidate[];
}

// ── Match Audit Logs ──

export interface AuditLogActor {
  id: string;
  username: string;
}

export interface AuditLogEntry {
  id: string;
  type: string;
  metadata: Record<string, unknown>;
  actor: AuditLogActor | null;
  createdAt: string;
}

export interface GetMatchAuditLogsResponse {
  items: AuditLogEntry[];
  pageInfo: PageInfo;
}

// ── Sessions ──

export interface SessionItem {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  appVersion?: string;
  ip?: string;
  isCurrent: boolean;
}

// ── Errors ──

export interface ApiErrorBody {
  type?: string;
  title?: string;
  status: number;
  code?: string;
  detail?: string;
  errors?: unknown;
  requestId?: string;
  suspendedUntil?: string;
  // Legacy compat (NestJS default shape)
  statusCode?: number;
  message?: string;
  error?: string;
}
