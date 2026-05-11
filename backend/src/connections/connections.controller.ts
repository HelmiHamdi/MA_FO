// src/connections/connections.controller.ts
import {
  Controller,
  Get,
  Delete,
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
import { ConnectionsService } from './connections.service';

@ApiTags('Connections Module')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  /**
   * GET /connections
   * 4.1 — Liste de toutes les connexions confirmées
   */
  @Get()
  @ApiOperation({
    summary: '4.1 — Liste des connexions confirmées',
    description:
      "Retourne toutes les connexions ACCEPTED. Chaque item inclut le profil de l'autre participant, le preview du dernier message, le nombre de messages non-lus, et le statut de réunion actuel.",
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sort', required: false, enum: ['activity', 'name', 'meeting'] })
  @ApiResponse({ status: 200, description: 'Liste paginée des connexions' })
  getMyConnections(
    @GetUser('id') participantId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    return this.connectionsService.getMyConnections(participantId, {
      page: Number(page),
      limit: Number(limit),
      search,
      sort,
    });
  }

  /**
   * GET /connections/:connectionId/profile
   * 4.2 — Profil complet d'une connexion
   * IMPORTANT: cette route DOIT être avant /:connectionId pour éviter
   * qu'Express capture "profile" comme un connectionId.
   */
  @Get(':connectionId/profile')
  @ApiOperation({
    summary: "4.2 — Profil complet d'une connexion",
    description:
      "Retourne le profil complet de l'autre participant, la metadata de connexion (type, aiExplanation), l'historique complet des réunions entre les deux, et la réunion active si elle existe.",
  })
  @ApiParam({ name: 'connectionId', description: 'UUID de la connexion' })
  @ApiResponse({ status: 200, description: 'Profil et historique de la connexion' })
  @ApiResponse({ status: 403, description: "Accès refusé — vous n'êtes pas dans cette connexion" })
  @ApiResponse({ status: 404, description: 'Connexion introuvable' })
  getConnectionProfile(
    @GetUser('id') participantId: string,
    @Param('connectionId') connectionId: string,
  ) {
    return this.connectionsService.getConnectionProfile(participantId, connectionId);
  }

  /**
   * DELETE /connections/:connectionId
   */
  @Delete(':connectionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retirer une connexion' })
  @ApiParam({ name: 'connectionId', description: 'UUID de la connexion' })
  @ApiResponse({ status: 200, description: 'Connexion supprimée' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Connexion introuvable' })
  removeConnection(
    @GetUser('id') participantId: string,
    @Param('connectionId') connectionId: string,
  ) {
    return this.connectionsService.removeConnection(participantId, connectionId);
  }
}