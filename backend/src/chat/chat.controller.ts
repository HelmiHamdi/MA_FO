
// src/chat/chat.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ChatService } from './chat.service';
import { SendMessageDto, GetMessagesQueryDto, MarkReadDto } from './dto';

@ApiTags('Chat Module')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ─────────────────────────────────────────────────────────────
  // 6.2 — Conversations list (inbox)
  // ─────────────────────────────────────────────────────────────

  /**
   * GET /chat/conversations
   */
  @Get('conversations')
  @ApiOperation({
    summary: '6.2 — Liste des conversations (inbox)',
    description:
      'Retourne toutes les conversations actives triées par activité récente. Chaque item inclut le dernier message, le compteur non-lu, et le statut de réunion avec le participant.',
  })
  @ApiResponse({ status: 200, description: 'Liste des conversations enrichies' })
  getConversations(@GetUser('id') participantId: string) {
    return this.chatService.getConversations(participantId);
  }

  /**
   * GET /chat/unread-count
   * IMPORTANT: avant /:conversationId
   */
  @Get('unread-count')
  @ApiOperation({
    summary: 'Nombre total de messages non lus',
    description: 'Retourne le total de messages non lus sur toutes les conversations.',
  })
  @ApiResponse({ status: 200, description: 'Nombre de messages non lus' })
  getTotalUnreadCount(@GetUser('id') participantId: string) {
    return this.chatService.getTotalUnreadCount(participantId);
  }

  // ─────────────────────────────────────────────────────────────
  // 6.1 — Conversation thread
  // ─────────────────────────────────────────────────────────────

  /**
   * GET /chat/:conversationId/messages
   */
  @Get(':conversationId/messages')
  @ApiOperation({
    summary: '6.1 — Messages du fil de conversation',
    description:
      'Retourne les messages paginés (curseur) dans l\'ordre chronologique, ainsi que les meet request cards liées à cette conversation. Pagination "infini scroll vers le haut" via le paramètre `before`.',
  })
  @ApiParam({ name: 'conversationId', description: 'UUID de la connexion (= conversationId)' })
  @ApiQuery({ name: 'before', required: false, description: 'Curseur ISO datetime pour pagination' })
  @ApiQuery({ name: 'limit', required: false, description: 'Nb messages par page (défaut 30)' })
  @ApiResponse({ status: 200, description: 'Messages + meet cards + info participant' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Conversation introuvable' })
  getMessages(
    @GetUser('id') participantId: string,
    @Param('conversationId') conversationId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.chatService.getMessages(participantId, conversationId, query);
  }

  /**
   * POST /chat/:conversationId/messages
   */
  @Post(':conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '6.1 — Envoyer un message',
    description:
      'Envoie un message texte dans la conversation. Déclenche une notification push si le destinataire est hors-ligne. Émet via WebSocket sinon.',
  })
  @ApiParam({ name: 'conversationId', description: 'UUID de la connexion' })
  @ApiResponse({ status: 201, description: 'Message envoyé' })
  @ApiResponse({ status: 400, description: 'Contenu invalide' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  sendMessage(
    @GetUser('id') participantId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(participantId, conversationId, dto);
  }

  /**
   * PATCH /chat/:conversationId/read
   */
  @Patch(':conversationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '6.1 — Marquer les messages comme lus',
    description:
      'Marque tous les messages reçus jusqu\'au `lastReadMessageId` comme lus. Émet un événement WebSocket `messages_read` pour les double-ticks bleus.',
  })
  @ApiParam({ name: 'conversationId', description: 'UUID de la conversation' })
  @ApiResponse({ status: 200, description: 'Messages marqués comme lus' })
  markRead(
    @GetUser('id') participantId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: MarkReadDto,
  ) {
    return this.chatService.markMessagesRead(
      participantId,
      conversationId,
      dto.lastReadMessageId,
    );
  }
}