// src/types/index.ts

// ─── AUTH ────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  isFirstLogin: boolean;
  needsProfileCompletion: boolean;
  participant: Participant;
}

export interface OtpRequestResponse {
  message: string;
  destination: string;
  resendAfterSeconds: number;
}

// ─── PARTICIPANT ──────────────────────────────────────────────────────────────

export type ProfileType = "INSTITUTIONNEL" | "VIP" | "OPERATEUR" | "MEDIA" | "STANDARD";

export interface Participant {
  id: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  company?: string;
  sector?: string;
  country?: string;
  bio?: string;
  bioEn?: string;
  photoUrl?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  tags?: string;
  profileType: ProfileType;
  isActive: boolean;
  isProfilePublic: boolean;
  language: string;
  linkedinConnected: boolean;
  visibilityScore: number;
  matchScore: number;
  createdAt: string;
  updatedAt: string;
}

// ─── DISCOVERY ────────────────────────────────────────────────────────────────

export type SwipeAction = "RIGHT" | "LEFT";
export type ConnectionStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "NOT_CONNECTED" | "REQUEST_SENT";
export type ConnectionType = "MATCHED" | "CONNECTED";

export interface PublicProfile {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  company?: string;
  sector?: string;
  country?: string;
  photoUrl?: string;
  tags?: string;
  profileType: ProfileType;
  visibilityScore: number;
  linkedinConnected: boolean;
  aiExplanation?: string;
  matchScore?: number;
  connectionStatus?: ConnectionStatus;
}

export interface SwipeBatchResponse {
  batchId: string;
  totalCount: number;
  remaining: number;
  swiped: number;
  isComplete: boolean;
  profiles: PublicProfile[];
}

export interface SwipeResponse {
  swipeRecorded: boolean;
  action: SwipeAction;
  batchProgress: { swiped: number; total: number; isComplete: boolean };
  match: MatchResult | null;
}

export interface MatchResult {
  isMatch: boolean;
  connectionId: string;
  matchedWith: { id: string; firstName: string; lastName: string };
}

export interface Connection {
  id: string;
  participantAId: string;
  participantBId: string;
  type: ConnectionType;
  status: ConnectionStatus;
  initiatedBy: string;
  aiExplanation?: string;
  createdAt: string;
}

export interface ViewAllResponse {
  data: PublicProfile[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ─── MEETINGS ─────────────────────────────────────────────────────────────────

export type MeetingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "RESCHEDULED";

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  table?: { number: number; room: string };
}

export interface Meeting {
  id: string;
  status: MeetingStatus;
  createdBy: "PARTICIPANT" | "ADMIN";
  requestMessage?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  completedAt?: string;
  slot?: TimeSlot;
  table?: { number: number; room: string };
  requester?: Partial<Participant>;
  receiver?: Partial<Participant>;
}

export interface AgendaResponse {
  byDay: Record<string, AgendaItem[]>;
  nextMeeting: (AgendaItem & { countdownMs: number }) | null;
}

export interface AgendaItem extends Meeting {
  otherParticipant: Partial<Participant>;
  isUpcoming: boolean;
  isPast: boolean;
  needsRating: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  canScanQr: boolean;
  conversationId?: string;
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export type NotificationType =
  | "NEW_SWIPE_BATCH"
  | "MUTUAL_MATCH"
  | "CONNECTION_REQUEST_RECEIVED"
  | "CONNECTION_REQUEST_ACCEPTED"
  | "MEETING_REQUEST_RECEIVED"
  | "MEETING_CONFIRMED"
  | "MEETING_REFUSED"
  | "MEETING_REMINDER"
  | "NEW_MESSAGE"
  | "MEETING_CANCELLED"
  | "MEETING_RESCHEDULED"
  | "POST_MEETING_RATING"
  | "BEHAVIORAL_NUDGE"
  | "PROFILE_VECTORIZED"
  | "ACCOUNT_ACTIVATED";

export interface Notification {
  id: string;
  participantId: string;
  type: NotificationType;
  title: string;
  body: string;
  deepLink?: string;
  isRead: boolean;
  metadata?: string;
  createdAt: string;
}

export interface NotificationsResponse {
  data: Notification[];
  unreadCount: number;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}