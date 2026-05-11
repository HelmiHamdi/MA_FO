// src/connections/connections.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MeetingStatus } from '@prisma/client';

const PARTICIPANT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  company: true,
  sector: true,
  country: true,
  bio: true,
  photoUrl: true,
  tags: true,
  linkedinUrl: true,
  linkedinConnected: true,
  profileType: true,
  visibilityScore: true,
  meetingMessage: true,
};

@Injectable()
export class ConnectionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  // 4.1 — Liste des connexions
  // ═══════════════════════════════════════════════════════════════

  async getMyConnections(
    participantId: string,
    options: { page: number; limit: number; search?: string; sort?: string },
  ) {
    const { page = 1, limit = 50, search, sort = 'activity' } = options;
    const skip = (page - 1) * limit;

    // Fetch all accepted connections
    const connections = await this.prisma.connection.findMany({
      where: {
        OR: [
          { participantAId: participantId },
          { participantBId: participantId },
        ],
        status: 'ACCEPTED',
      },
      include: {
        participantA: { select: PARTICIPANT_SELECT },
        participantB: { select: PARTICIPANT_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich each connection with meeting status and message data
    const enriched = await Promise.all(
      connections.map(async (conn) => {
        const otherParticipant =
          conn.participantAId === participantId
            ? conn.participantB
            : conn.participantA;

        // Search filter (done here since we need joined data)
        if (search) {
          const q = search.toLowerCase();
          const fullName =
            `${otherParticipant.firstName} ${otherParticipant.lastName}`.toLowerCase();
          const company = (otherParticipant.company ?? '').toLowerCase();
          if (!fullName.includes(q) && !company.includes(q)) return null;
        }

        // Latest meeting between these two participants
        // NOTE: Connection.conversationId links to Meeting.conversationId
        // Meetings are found via requesterId/receiverId, NOT via Connection relation
        const latestMeeting = await this.prisma.meeting.findFirst({
          where: {
            OR: [
              { requesterId: participantId, receiverId: otherParticipant.id },
              { requesterId: otherParticipant.id, receiverId: participantId },
            ],
            status: {
              in: [
                MeetingStatus.PENDING,
                MeetingStatus.CONFIRMED,
                MeetingStatus.COMPLETED,
                MeetingStatus.CANCELLED,
              ],
            },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true },
        });

        const meetingStatus = latestMeeting?.status ?? 'NONE';

        // Last message: Meeting.conversationId is the Connection.id in this schema
        // Messages are sent within a conversation identified by the connection id
        // If no Message model exists yet, gracefully skip
        let lastMessage: {
          content: string;
          createdAt: Date;
          isRead: boolean;
        } | null = null;
        let unreadCount = 0;

        try {
          const lastMsg = await (this.prisma as any).message?.findFirst({
            where: { conversationId: conn.id },
            orderBy: { createdAt: 'desc' },
            select: {
              content: true,
              createdAt: true,
              senderId: true,
              isRead: true,
            },
          });

          if (lastMsg) {
            lastMessage = {
              content: lastMsg.content,
              createdAt: lastMsg.createdAt,
              isRead:
                lastMsg.senderId === participantId ? true : lastMsg.isRead,
            };

            unreadCount = await (this.prisma as any).message?.count({
              where: {
                conversationId: conn.id,
                senderId: { not: participantId },
                isRead: false,
              },
            }) ?? 0;
          }
        } catch {
          // Message model not yet available — skip gracefully
        }

        return {
          id: conn.id,
          otherParticipant,
          type: conn.type,
          status: conn.status,
          aiExplanation: conn.aiExplanation ?? null,
          lastMessage,
          unreadCount,
          meetingStatus,
          meetingId: latestMeeting?.id ?? null,
          conversationId: conn.id,
          createdAt: conn.createdAt,
        };
      }),
    );

    const filtered = enriched.filter(Boolean) as NonNullable<
      (typeof enriched)[number]
    >[];

    // Sort
    if (sort === 'name') {
      filtered.sort((a, b) =>
        `${a.otherParticipant.firstName} ${a.otherParticipant.lastName}`.localeCompare(
          `${b.otherParticipant.firstName} ${b.otherParticipant.lastName}`,
        ),
      );
    } else if (sort === 'meeting') {
      const order = ['CONFIRMED', 'PENDING', 'COMPLETED', 'NONE', 'CANCELLED'];
      filtered.sort(
        (a, b) =>
          order.indexOf(a.meetingStatus) - order.indexOf(b.meetingStatus),
      );
    } else {
      // activity: sort by most recent last message, then connection date
      filtered.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt ?? a.createdAt;
        const bTime = b.lastMessage?.createdAt ?? b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
    }

    const paginated = filtered.slice(skip, skip + limit);

    return {
      data: paginated,
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 4.2 — Profil complet d'une connexion
  // ═══════════════════════════════════════════════════════════════

  async getConnectionProfile(participantId: string, connectionId: string) {
    const conn = await this.prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        participantA: { select: PARTICIPANT_SELECT },
        participantB: { select: PARTICIPANT_SELECT },
      },
    });

    if (!conn) throw new NotFoundException('Connexion introuvable');

    const isParticipant =
      conn.participantAId === participantId ||
      conn.participantBId === participantId;

    if (!isParticipant) {
      throw new ForbiddenException('Accès refusé à cette connexion');
    }

    const otherParticipant =
      conn.participantAId === participantId
        ? conn.participantB
        : conn.participantA;

    // Full meeting history between these two participants
    const meetingHistory = await this.prisma.meeting.findMany({
      where: {
        OR: [
          { requesterId: participantId, receiverId: otherParticipant.id },
          { requesterId: otherParticipant.id, receiverId: participantId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        confirmedAt: true,
        slot: {
          select: { startTime: true, endTime: true },
        },
        table: {
          select: { number: true, room: true },
        },
      },
    });

    const STATUS_LABELS: Record<string, string> = {
      PENDING: 'En attente',
      CONFIRMED: 'Confirmée',
      CANCELLED: 'Annulée',
      COMPLETED: 'Terminée',
      RESCHEDULED: 'Replanifiée',
    };

    const meetingHistoryFormatted = meetingHistory.map((m) => ({
      ...m,
      statusLabel: STATUS_LABELS[m.status] ?? m.status,
    }));

    // Current active meeting (PENDING or CONFIRMED)
    const currentMeeting = await this.prisma.meeting.findFirst({
      where: {
        OR: [
          { requesterId: participantId, receiverId: otherParticipant.id },
          { requesterId: otherParticipant.id, receiverId: participantId },
        ],
        status: { in: [MeetingStatus.PENDING, MeetingStatus.CONFIRMED] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        slot: { select: { startTime: true, endTime: true } },
        table: { select: { number: true, room: true } },
      },
    });

    const meetingStatus = currentMeeting?.status ?? 'NONE';

    return {
      connection: {
        id: conn.id,
        type: conn.type,
        status: conn.status,
        aiExplanation: conn.aiExplanation ?? null,
        meetingStatus,
        meetingId: currentMeeting?.id ?? null,
        conversationId: conn.id,
        createdAt: conn.createdAt,
      },
      participant: otherParticipant,
      meetingHistory: meetingHistoryFormatted,
      currentMeeting: currentMeeting ?? null,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Supprimer une connexion
  // ═══════════════════════════════════════════════════════════════

  async removeConnection(participantId: string, connectionId: string) {
    const conn = await this.prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!conn) throw new NotFoundException('Connexion introuvable');

    const isParticipant =
      conn.participantAId === participantId ||
      conn.participantBId === participantId;

    if (!isParticipant) {
      throw new ForbiddenException('Accès refusé');
    }

    await this.prisma.connection.delete({ where: { id: connectionId } });

    return { success: true, message: 'Connexion supprimée', connectionId };
  }
}