// src/chat/chat.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatGateway } from './chat.gateway';
import { SendMessageDto, GetMessagesQueryDto } from './dto';
import { MessageType } from '@prisma/client';

const PARTICIPANT_SELECT_MINI = {
  id: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  company: true,
  photoUrl: true,
  profileType: true,
};

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly gateway: ChatGateway,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // 6.2 — Liste des conversations (inbox)
  // ═══════════════════════════════════════════════════════════════

  async getConversations(participantId: string) {
    const connections = await this.prisma.connection.findMany({
      where: {
        OR: [
          { participantAId: participantId },
          { participantBId: participantId },
        ],
        status: 'ACCEPTED',
      },
      include: {
        participantA: { select: PARTICIPANT_SELECT_MINI },
        participantB: { select: PARTICIPANT_SELECT_MINI },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            type: true,
            senderId: true,
            isRead: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Enrich with unread count, meeting status, online presence
    const enriched = await Promise.all(
      connections.map(async (conn) => {
        const otherParticipant =
          conn.participantAId === participantId
            ? conn.participantB
            : conn.participantA;

        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conn.id,
            senderId: { not: participantId },
            isRead: false,
          },
        });

        // Latest meeting status
        const latestMeeting = await this.prisma.meeting.findFirst({
          where: {
            OR: [
              { requesterId: participantId, receiverId: otherParticipant.id },
              { requesterId: otherParticipant.id, receiverId: participantId },
            ],
            status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true },
        });

        const lastMessage = conn.messages[0] ?? null;
        const isOnline = this.gateway.isOnline(otherParticipant.id);

        return {
          id: conn.id,
          otherParticipant: {
            ...otherParticipant,
            isOnline,
          },
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                type: lastMessage.type,
                isMine: lastMessage.senderId === participantId,
                isRead: lastMessage.isRead,
                createdAt: lastMessage.createdAt,
              }
            : null,
          unreadCount,
          meetingStatus: latestMeeting?.status ?? 'NONE',
          meetingId: latestMeeting?.id ?? null,
          updatedAt: conn.updatedAt,
        };
      }),
    );

    // Sort by most recent activity (last message > connection update)
    const sorted = enriched.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ?? a.updatedAt;
      const bTime = b.lastMessage?.createdAt ?? b.updatedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    return {
      data: sorted,
      total: sorted.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 6.1 — Fil de conversation (messages + meet cards)
  // ═══════════════════════════════════════════════════════════════

  async getMessages(
    participantId: string,
    conversationId: string,
    query: GetMessagesQueryDto,
  ) {
    const { before, limit = 30 } = query;

    // Verify access
    const connection = await this.getConnectionOrThrow(participantId, conversationId);

    const otherParticipant =
      connection.participantAId === participantId
        ? connection.participantB
        : connection.participantA;

    // Load messages with cursor pagination (infinite scroll upward)
    const whereClause: any = { conversationId };
    if (before) {
      whereClause.createdAt = { lt: new Date(before) };
    }

    const messages = await this.prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // fetch one extra to know if there's more
      include: {
        sender: { select: PARTICIPANT_SELECT_MINI },
      },
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;

    // Mark received messages as delivered (if not already)
    const undelivered = items.filter(
      (m) => m.senderId !== participantId && !m.deliveredAt,
    );
    if (undelivered.length > 0) {
      await this.prisma.message.updateMany({
        where: {
          id: { in: undelivered.map((m) => m.id) },
          senderId: { not: participantId },
          deliveredAt: null,
        },
        data: { deliveredAt: new Date() },
      });

      // Notify senders of delivery
      for (const msg of undelivered) {
        this.gateway.emitMessageDelivered(msg.senderId, msg.id, conversationId);
      }
    }

    // Load pending meeting cards for this conversation
    const pendingMeetings = await this.prisma.meeting.findMany({
      where: {
        conversationId,
        status: { in: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'RESCHEDULED'] },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        slot: true,
        table: true,
        requester: { select: PARTICIPANT_SELECT_MINI },
        receiver: { select: PARTICIPANT_SELECT_MINI },
      },
    });

    // Merge messages + meeting cards into a unified timeline
    // Meeting cards are displayed inline as a special type
    const meetingCards = pendingMeetings.map((m) => ({
      id: `meeting-card-${m.id}`,
      type: 'MEET_REQUEST_CARD' as const,
      meetingId: m.id,
      meetingStatus: m.status,
      meetingCreatedBy: m.createdBy,
      requestMessage: m.requestMessage,
      refuseReason: m.refuseReason,
      slot: m.slot
        ? { id: m.slot.id, startTime: m.slot.startTime, endTime: m.slot.endTime }
        : null,
      table: m.table ? { number: m.table.number, room: m.table.room } : null,
      requester: m.requester,
      receiver: m.receiver,
      isMine: m.requesterId === participantId,
      canRespond:
        m.receiverId === participantId &&
        m.status === 'PENDING' &&
        m.createdBy === 'PARTICIPANT',
      createdAt: m.createdAt,
    }));

    const formattedMessages = items.reverse().map((m) => ({
      id: m.id,
      type: m.type,
      content: m.content,
      metadata: m.metadata ?? null,
      senderId: m.senderId,
      isMine: m.senderId === participantId,
      sender: m.sender,
      isRead: m.isRead,
      deliveredAt: m.deliveredAt,
      readAt: m.readAt,
      createdAt: m.createdAt,
    }));

    return {
      conversationId,
      otherParticipant: {
        ...otherParticipant,
        isOnline: this.gateway.isOnline(otherParticipant.id),
      },
      messages: formattedMessages,
      meetingCards,
      hasMore,
      oldestMessageCursor: items.length > 0 ? items[items.length - 1].createdAt : null,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Send message
  // ═══════════════════════════════════════════════════════════════

  async sendMessage(
    participantId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const connection = await this.getConnectionOrThrow(participantId, conversationId);

    const otherParticipant =
      connection.participantAId === participantId
        ? connection.participantB
        : connection.participantA;

    const sender = await this.prisma.participant.findUnique({
      where: { id: participantId },
      select: PARTICIPANT_SELECT_MINI,
    });

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: participantId,
        content: dto.content,
        type: (dto.type as MessageType) ?? MessageType.TEXT,
        metadata: dto.metadata ?? null,
        isRead: false,
      },
      include: {
        sender: { select: PARTICIPANT_SELECT_MINI },
      },
    });

    // Update connection updatedAt for sort ordering
    await this.prisma.connection.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const payload = {
      id: message.id,
      type: message.type,
      content: message.content,
      metadata: message.metadata ?? null,
      senderId: participantId,
      isMine: false, // from receiver's perspective
      sender: message.sender,
      isRead: false,
      deliveredAt: null,
      readAt: null,
      conversationId,
      createdAt: message.createdAt,
    };

    // Emit via WebSocket to conversation room
    this.gateway.emitNewMessage(conversationId, payload);

    // Mark as delivered immediately if recipient is online
    const isRecipientOnline = this.gateway.isOnline(otherParticipant.id);
    if (isRecipientOnline) {
      await this.prisma.message.update({
        where: { id: message.id },
        data: { deliveredAt: new Date() },
      });
    } else {
      // Send push notification
      await this.notifications.sendPushNotification(otherParticipant.id, {
        title: `${sender.firstName} ${sender.lastName}`,
        body:
          dto.content.length > 80
            ? `${dto.content.slice(0, 80)}…`
            : dto.content,
      });

      await this.notifications.createInAppNotification({
        participantId: otherParticipant.id,
        type: 'NEW_MESSAGE',
        title: `💬 Message de ${sender.firstName}`,
        body:
          dto.content.length > 100
            ? `${dto.content.slice(0, 100)}…`
            : dto.content,
        deepLink: `/chat/${conversationId}`,
        metadata: JSON.stringify({
          conversationId,
          messageId: message.id,
          senderId: participantId,
        }),
      });
    }

    return {
      ...payload,
      isMine: true, // from sender's perspective
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Mark messages as read
  // ═══════════════════════════════════════════════════════════════

  async markMessagesRead(
    participantId: string,
    conversationId: string,
    lastReadMessageId: string,
  ) {
    await this.getConnectionOrThrow(participantId, conversationId);

    // Get the timestamp of the last read message
    const lastMsg = await this.prisma.message.findUnique({
      where: { id: lastReadMessageId },
      select: { createdAt: true, conversationId: true },
    });

    if (!lastMsg || lastMsg.conversationId !== conversationId) {
      throw new NotFoundException('Message introuvable dans cette conversation');
    }

    // Mark all messages from the other participant as read up to this point
    const updated = await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: participantId },
        isRead: false,
        createdAt: { lte: lastMsg.createdAt },
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Emit read receipt to the other participant via WebSocket
    if (updated.count > 0) {
      this.gateway.emitMessagesRead(conversationId, participantId, lastReadMessageId);
    }

    return { success: true, updatedCount: updated.count };
  }

  // ═══════════════════════════════════════════════════════════════
  // Get unread count across all conversations
  // ═══════════════════════════════════════════════════════════════

  async getTotalUnreadCount(participantId: string) {
    const count = await this.prisma.message.count({
      where: {
        conversation: {
          OR: [
            { participantAId: participantId },
            { participantBId: participantId },
          ],
          status: 'ACCEPTED',
        },
        senderId: { not: participantId },
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  // ═══════════════════════════════════════════════════════════════
  // Helper: verify connection access
  // ═══════════════════════════════════════════════════════════════

  private async getConnectionOrThrow(participantId: string, conversationId: string) {
    const connection = await this.prisma.connection.findFirst({
      where: {
        id: conversationId,
        OR: [
          { participantAId: participantId },
          { participantBId: participantId },
        ],
        status: 'ACCEPTED',
      },
      include: {
        participantA: { select: PARTICIPANT_SELECT_MINI },
        participantB: { select: PARTICIPANT_SELECT_MINI },
      },
    });

    if (!connection) {
      throw new NotFoundException('Conversation introuvable');
    }

    return connection;
  }
}