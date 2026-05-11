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

export type ProfileType =
  | "INSTITUTIONNEL"
  | "VIP"
  | "OPERATEUR"
  | "MEDIA"
  | "STANDARD";

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
  meetingMessage?: string;
  profileType: ProfileType;
  isActive: boolean;
  isProfilePublic: boolean;
  language: string;
  linkedinConnected: boolean;
  hasSeenProfilePrompt: boolean;
  visibilityScore: number;
  matchScore: number;
  createdAt: string;
  updatedAt: string;
}

// ─── DISCOVERY ────────────────────────────────────────────────────────────────

export type SwipeAction = "RIGHT" | "LEFT";
export type ConnectionStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "NOT_CONNECTED"
  | "REQUEST_SENT";
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
  hasSeenProfilePrompt: boolean;
  visibilityScore: number;
  linkedinConnected: boolean;
  aiExplanation?: string;
  matchScore?: number;
  connectionStatus?: "CONNECTED" | "REQUEST_SENT" | "NOT_CONNECTED";
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
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── CONNECTIONS ─────────────────────────────────────────────────────────────

export interface ConnectionListItem {
  id: string;
  otherParticipant: PublicProfile;
  type: ConnectionType;
  status: ConnectionStatus;
  lastMessage?: {
    content: string;
    createdAt: string;
    isRead: boolean;
  } | null;
  unreadCount: number;
  meetingStatus: "NONE" | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  meetingId?: string | null;
  conversationId?: string | null;
  createdAt: string;
}

export interface ConnectionsResponse {
  data: ConnectionListItem[];
  pagination: Pagination;
}

// ─── MEETINGS ─────────────────────────────────────────────────────────────────

export type MeetingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "RESCHEDULED";

export type MeetingCreatedBy = "PARTICIPANT" | "ADMIN";

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  isAvailable?: boolean;
  table?: {
    id?: string;
    number: number;
    room: string;
  } | null;
}

export interface TableInfo {
  number: number;
  room: string;
}

export interface Meeting {
  id: string;
  status: MeetingStatus;
  statusLabel?: string;
  createdBy: MeetingCreatedBy;
  requestMessage?: string | null;
  refuseReason?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
  qrConfirmedAt?: string | null;
  conversationId?: string | null;
  slot?: TimeSlot | null;
  table?: TableInfo | null;
  requester?: Partial<Participant> | null;
  receiver?: Partial<Participant> | null;
}

// ─── Available Slots Response ─────────────────────────────────────────────────

export interface AvailableSlotsResponse {
  available: boolean;
  message?: string;
  slotsByDay: Record<string, TimeSlot[]>;
  totalAvailable?: number;
}

// ─── Agenda Response ──────────────────────────────────────────────────────────

export interface AgendaResponse {
  byDay: Record<string, AgendaItem[]>;
  totalMeetings: number;
  nextMeeting: (AgendaItem & { countdownMs: number }) | null;
}

// ─── Agenda Item ──────────────────────────────────────────────────────────────

export interface AgendaItem {
  id: string;
  status: MeetingStatus;
  statusLabel: string;
  createdBy: MeetingCreatedBy;
  requestMessage?: string | null;
  refuseReason?: string | null;
  otherParticipant: Participant;
  slot: { id: string; startTime: string; endTime: string } | null;
  table: TableInfo | null;
  conversationId?: string | null;
  // Flags d'action
  isUpcoming: boolean;
  isPast: boolean;
  needsRating: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  canScanQr: boolean;
  hasRated: boolean;
}

// ─── Meeting Detail ───────────────────────────────────────────────────────────

export interface MeetingDetail {
  id: string;
  status: MeetingStatus;
  statusLabel: string;
  createdBy: MeetingCreatedBy;
  requestMessage: string | null;
  refuseReason: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  qrConfirmedAt: string | null;
  conversationId: string | null;
  slot: { id: string; startTime: string; endTime: string } | null;
  table: TableInfo | null;
  requester: Participant | null;
  receiver: Participant | null;
  otherParticipant?: Participant;
  myRating?: {
    stars: number;
    comment: string | null;
    isSubmitted: boolean;
    createdAt: string;
  } | null;
}

// ─── Meeting Request Flow ─────────────────────────────────────────────────────

export interface GenerateMessageResponse {
  message: string;
  source: "profile" | "ai";
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
  pagination: Pagination;
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
// ─── CHAT ─────────────────────────────────────────────────────────────────────
 
export type MessageType = "TEXT" | "SYSTEM" | "MEET_REQUEST_CARD";
 
export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  metadata?: string | null;
  senderId: string;
  isMine: boolean;
  sender: Partial<Participant> | null;
  isRead: boolean;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}
 
export interface MeetCard {
  id: string;
  type: "MEET_REQUEST_CARD";
  meetingId: string;
  meetingStatus: string;
  meetingCreatedBy: "PARTICIPANT" | "ADMIN";
  requestMessage?: string | null;
  refuseReason?: string | null;
  slot?: { id: string; startTime: string; endTime: string } | null;
  table?: { number: number; room: string } | null;
  requester?: Partial<Participant> | null;
  receiver?: Partial<Participant> | null;
  isMine: boolean;
  canRespond: boolean;
  createdAt: string;
}
 
export interface ConversationItem {
  id: string;
  otherParticipant: Partial<Participant> & { isOnline?: boolean };
  lastMessage: {
    id: string;
    content: string;
    type: MessageType;
    isMine: boolean;
    isRead: boolean;
    createdAt: string;
  } | null;
  unreadCount: number;
  meetingStatus: "NONE" | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  meetingId?: string | null;
  updatedAt: string;
}
 
export interface ThreadResponse {
  conversationId: string;
  otherParticipant: Partial<Participant> & { isOnline?: boolean };
  messages: ChatMessage[];
  meetingCards: MeetCard[];
  hasMore: boolean;
  oldestMessageCursor: string | null;
}
 
export interface ConversationsResponse {
  data: ConversationItem[];
  total: number;
}
