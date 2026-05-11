// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Map participantId → Set of socket ids (multi-tab support)
  private readonly connectedUsers = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Connection lifecycle ───────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.config.get('JWT_SECRET'),
      });

      const participantId: string = payload.sub;
      client.data.participantId = participantId;

      // Join personal room for direct targeting
      client.join(`user:${participantId}`);

      // Track connected sockets
      if (!this.connectedUsers.has(participantId)) {
        this.connectedUsers.set(participantId, new Set());
      }
      this.connectedUsers.get(participantId)!.add(client.id);

      this.logger.log(`Client connected: ${participantId} (${client.id})`);

      // Emit online presence to all conversations
      this.broadcastPresence(participantId, true);
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const participantId = client.data.participantId;
    if (!participantId) return;

    const sockets = this.connectedUsers.get(participantId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.connectedUsers.delete(participantId);
        this.broadcastPresence(participantId, false);
      }
    }

    this.logger.log(`Client disconnected: ${participantId} (${client.id})`);
  }

  // ─── Join conversation room ─────────────────────────────────────────────────

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const participantId = client.data.participantId;
    if (!participantId) throw new WsException('Unauthorized');

    // Verify participant belongs to this connection/conversation
    const connection = await this.prisma.connection.findFirst({
      where: {
        id: data.conversationId,
        OR: [
          { participantAId: participantId },
          { participantBId: participantId },
        ],
        status: 'ACCEPTED',
      },
    });

    if (!connection) {
      throw new WsException('Conversation introuvable ou accès refusé');
    }

    client.join(`conv:${data.conversationId}`);
    client.emit('joined_conversation', { conversationId: data.conversationId });
  }

  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conv:${data.conversationId}`);
  }

  // ─── Typing indicators ──────────────────────────────────────────────────────

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const participantId = client.data.participantId;
    if (!participantId) return;

    client.to(`conv:${data.conversationId}`).emit('user_typing', {
      conversationId: data.conversationId,
      participantId,
    });
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const participantId = client.data.participantId;
    if (!participantId) return;

    client.to(`conv:${data.conversationId}`).emit('user_stopped_typing', {
      conversationId: data.conversationId,
      participantId,
    });
  }

  // ─── Public emitters (called by ChatService) ───────────────────────────────

  /**
   * Emit new message to all sockets in a conversation room
   */
  emitNewMessage(conversationId: string, message: any) {
    this.server.to(`conv:${conversationId}`).emit('new_message', message);
  }

  /**
   * Emit read receipt update to a specific participant
   */
  emitMessagesRead(conversationId: string, readByParticipantId: string, lastReadMessageId: string) {
    this.server.to(`conv:${conversationId}`).emit('messages_read', {
      conversationId,
      readByParticipantId,
      lastReadMessageId,
    });
  }

  /**
   * Emit message delivered status
   */
  emitMessageDelivered(participantId: string, messageId: string, conversationId: string) {
    this.server.to(`user:${participantId}`).emit('message_delivered', {
      messageId,
      conversationId,
    });
  }

  /**
   * Check if a participant is currently online
   */
  isOnline(participantId: string): boolean {
    return this.connectedUsers.has(participantId);
  }

  // ─── Presence broadcasting ──────────────────────────────────────────────────

  private async broadcastPresence(participantId: string, isOnline: boolean) {
    // Find all conversations this participant is in
    try {
      const connections = await this.prisma.connection.findMany({
        where: {
          OR: [
            { participantAId: participantId },
            { participantBId: participantId },
          ],
          status: 'ACCEPTED',
        },
        select: { id: true, participantAId: true, participantBId: true },
      });

      for (const conn of connections) {
        this.server.to(`conv:${conn.id}`).emit('presence_update', {
          participantId,
          isOnline,
          conversationId: conn.id,
        });
      }
    } catch {
      // non-critical
    }
  }
}