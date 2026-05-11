// src/discovery/discovery.controller.ts
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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { DiscoveryService } from './discovery.service';
import {
  SwipeDto,
  ViewAllFilterDto,
  ConnectionRequestDto,
  RespondConnectionDto,
} from './dto';

@ApiTags('Discovery Module')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('discovery')
export class DiscoveryController {
  constructor(private discoveryService: DiscoveryService) {}

  // ─── 3.1 SWIPE MODE ──────────────────────────

  // Route canonique
  @Get('swipe/batch')
  @ApiOperation({ summary: '3.1 Récupère le batch de swipe actif (ou en crée un nouveau)' })
  getCurrentBatch(@GetUser('id') participantId: string) {
    return this.discoveryService.getCurrentBatch(participantId);
  }

  // Alias défensif — couvre GET /discovery/swipe (URL tronquée envoyée par le frontend)
  // À supprimer une fois corrigé côté frontend/next.config.js
  @Get('swipe/current')
  @ApiOperation({
    summary: '3.1 Alias de swipe/batch (compatibilité temporaire)',
    deprecated: true,
  })
  getCurrentBatchAlias(@GetUser('id') participantId: string) {
    return this.discoveryService.getCurrentBatch(participantId);
  }

  @Post('swipe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '3.1 Enregistre un swipe (RIGHT ou LEFT)' })
  recordSwipe(@GetUser('id') participantId: string, @Body() dto: SwipeDto) {
    return this.discoveryService.recordSwipe(participantId, dto);
  }

  // ─── 3.2 VIEW ALL MODE ────────────────────────

  @Get('all')
  @ApiOperation({
    summary: '3.2 Liste tous les participants avec filtres classiques + filtre IA',
  })
  viewAll(@GetUser('id') participantId: string, @Query() filters: ViewAllFilterDto) {
    return this.discoveryService.viewAll(participantId, filters);
  }

  @Get('profile/:id')
  @ApiOperation({ summary: "3.2 Profil complet d'un participant" })
  getProfile(@GetUser('id') viewerId: string, @Param('id') targetId: string) {
    return this.discoveryService.getParticipantProfile(viewerId, targetId);
  }

  // ─── CONNECTIONS ──────────────────────────────

  @Post('connections/request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '3.2 Envoyer une demande de connexion' })
  sendConnectionRequest(
    @GetUser('id') senderId: string,
    @Body() dto: ConnectionRequestDto,
  ) {
    return this.discoveryService.sendConnectionRequest(senderId, dto.targetParticipantId);
  }

  @Patch('connections/:connectionId/respond')
  @ApiOperation({ summary: '3.2 Accepter ou refuser une demande de connexion' })
  respondToConnection(
    @GetUser('id') participantId: string,
    @Param('connectionId') connectionId: string,
    @Body() dto: RespondConnectionDto,
  ) {
    return this.discoveryService.respondToConnectionRequest(
      participantId,
      connectionId,
      dto.action,
    );
  }
}