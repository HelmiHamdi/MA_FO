// src/meetings/meetings.controller.ts
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
import { MeetingsService } from './meetings.service';
import {
  RequestMeetingDto,
  RespondMeetingDto,
  RescheduleMeetingDto,
  RateMeetingDto,
  ScanTableQrDto,
  GetSlotsQueryDto,
  AdminCreateMeetingDto,
} from './dto';

@ApiTags('B2B Meetings Module')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  // ─────────────────────────────────────────────────────────────
  // 5.1 MEETING REQUEST FLOW
  // ─────────────────────────────────────────────────────────────

  /**
   * GET /meetings/slots/available?receiverId=xxx
   * Retourne les créneaux disponibles mutuellement entre le demandeur et le récepteur.
   */
  @Get('slots/available')
  @ApiOperation({
    summary: '5.1 — Créneaux mutuellement disponibles',
    description:
      "Retourne les créneaux libres pour les deux participants. Seuls les créneaux où ni A ni B n'ont de réunion PENDING ou CONFIRMED sont affichés. Si aucun créneau n'est disponible, retourne available: false avec message suggérant de contacter l'organisateur.",
  })
  @ApiQuery({ name: 'receiverId', description: 'UUID du participant destinataire' })
  @ApiResponse({ status: 200, description: 'Liste des créneaux disponibles groupés par jour' })
  @ApiResponse({ status: 400, description: 'receiverId manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Connexion non établie entre les deux participants' })
  getAvailableSlots(
    @GetUser('id') requesterId: string,
    @Query() query: GetSlotsQueryDto,
  ) {
    return this.meetingsService.getAvailableSlots(requesterId, query.receiverId);
  }

  /**
   * GET /meetings/generate-message/:receiverId
   * Pré-génère un message de demande de réunion via GPT-4o.
   * IMPORTANT: doit être AVANT /:meetingId sinon Express capture 'generate-message' comme meetingId
   */
  @Get('generate-message/:receiverId')
  @ApiOperation({
    summary: 'Pré-générer un message IA personnalisé (step 4 du flow 5.1)',
    description:
      'Génère un message de demande de réunion personnalisé via GPT-4o basé sur les profils des deux participants.',
  })
  @ApiParam({ name: 'receiverId', description: 'UUID du participant destinataire' })
  @ApiResponse({ status: 200, description: 'Message IA généré (éditable)' })
  async preGenerateMessage(
    @GetUser() requester: any,
    @Param('receiverId') receiverId: string,
  ) {
    return this.meetingsService.preGenerateMessageForSlotScreen(requester.id, receiverId);
  }

  /**
   * GET /meetings/agenda
   * IMPORTANT: doit être AVANT /:meetingId sinon Express capture 'agenda' comme meetingId
   */
  @Get('agenda')
  @ApiOperation({
    summary: '5.3 — Mon agenda complet (groupé par jour)',
    description:
      "Retourne toutes les réunions du participant (en tant que requester ou receiver), groupées par jour. Chaque item contient les flags d'action: canCancel, canReschedule, canScanQr, needsRating. Inclut la nextMeeting avec countdownMs. Réunions CANCELLED exclues.",
  })
  @ApiResponse({ status: 200, description: 'Agenda structuré par jour avec nextMeeting' })
  getMyAgenda(@GetUser('id') participantId: string) {
    return this.meetingsService.getMyAgenda(participantId);
  }

  /**
   * POST /meetings/request
   */
  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '5.1 — Envoyer une demande de réunion',
    description:
      "Crée une demande en statut PENDING. Si `message` est absent, utilise le message personnalisé du profil (meetingMessage) ou génère via GPT-4o. Notifie le récepteur par push, SMS et email.",
  })
  @ApiResponse({ status: 201, description: 'Demande de réunion créée et notification envoyée' })
  @ApiResponse({ status: 400, description: 'Créneau non disponible ou données invalides' })
  @ApiResponse({ status: 403, description: 'Connexion ACCEPTED requise entre les deux participants' })
  @ApiResponse({ status: 409, description: "Créneau déjà pris par l'un des deux participants" })
  requestMeeting(
    @GetUser('id') requesterId: string,
    @Body() dto: RequestMeetingDto,
  ) {
    return this.meetingsService.requestMeeting(requesterId, dto);
  }

  /**
   * POST /meetings/confirm-table-qr
   * IMPORTANT: doit être AVANT /:meetingId
   */
  @Post('confirm-table-qr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '5.5 — Scanner le QR de table pour confirmer la présence physique',
    description:
      "Valide que le QR scanné correspond à la table assignée pour cette réunion. En cas de correspondance, le statut passe à COMPLETED et les deux participants reçoivent une notification pour évaluer la réunion.",
  })
  @ApiResponse({ status: 200, description: 'Présence confirmée — réunion passée en COMPLETED' })
  @ApiResponse({ status: 400, description: 'QR invalide, table incorrecte, ou réunion non confirmée' })
  @ApiResponse({ status: 403, description: "Vous n'êtes pas participant à cette réunion" })
  confirmTableQr(
    @GetUser('id') participantId: string,
    @Body() dto: ScanTableQrDto,
  ) {
    return this.meetingsService.confirmTableQr(participantId, dto);
  }

  /**
   * POST /meetings/admin/create
   */
  @Post('admin/create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Admin — Créer une réunion forcée (carte informative)',
    description:
      "Crée une réunion avec createdBy = ADMIN. La carte in-chat est informative uniquement, sans boutons Accept/Refuse.",
  })
  @ApiResponse({ status: 201, description: 'Réunion admin créée' })
  adminCreateMeeting(@Body() dto: AdminCreateMeetingDto) {
    return this.meetingsService.adminCreateMeeting(dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Routes avec :meetingId — TOUJOURS en dernier
  // ─────────────────────────────────────────────────────────────

  /**
   * GET /meetings/:meetingId
   */
  @Get(':meetingId')
  @ApiOperation({
    summary: "Détails d'une réunion",
    description:
      "Retourne tous les détails d'une réunion incluant les participants, le créneau, la table et le statut de rating.",
  })
  @ApiParam({ name: 'meetingId', description: 'UUID de la réunion' })
  @ApiResponse({ status: 200, description: 'Détails complets de la réunion' })
  @ApiResponse({ status: 403, description: "Accès refusé — vous n'êtes pas participant" })
  @ApiResponse({ status: 404, description: 'Réunion introuvable' })
  getMeetingById(
    @GetUser('id') participantId: string,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetingsService.getMeetingById(participantId, meetingId);
  }

  /**
   * PATCH /meetings/:meetingId/respond
   */
  @Patch(':meetingId/respond')
  @ApiOperation({
    summary: '5.2 — Accepter ou refuser une demande (carte in-chat)',
    description:
      "Seul le récepteur (B) peut appeler cet endpoint. La réunion doit être en statut PENDING.",
  })
  @ApiParam({ name: 'meetingId', description: 'UUID de la réunion à traiter' })
  @ApiResponse({ status: 200, description: 'Réponse enregistrée — statut mis à jour' })
  @ApiResponse({ status: 400, description: 'Réunion déjà traitée ou statut incompatible' })
  @ApiResponse({ status: 403, description: 'Seul le récepteur peut répondre / réunion admin non modifiable' })
  @ApiResponse({ status: 404, description: 'Réunion introuvable' })
  respondToMeeting(
    @GetUser('id') participantId: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: RespondMeetingDto,
  ) {
    return this.meetingsService.respondToMeeting(participantId, meetingId, dto);
  }

  /**
   * PATCH /meetings/:meetingId/cancel
   */
  @Patch(':meetingId/cancel')
  @ApiOperation({
    summary: '5.3 — Annuler une réunion confirmée',
    description:
      "N'importe lequel des deux participants peut annuler. Libère le créneau. Notifie l'autre participant.",
  })
  @ApiParam({ name: 'meetingId', description: 'UUID de la réunion à annuler' })
  @ApiResponse({ status: 200, description: 'Réunion annulée, créneau libéré' })
  @ApiResponse({ status: 400, description: 'Réunion déjà annulée ou terminée' })
  @ApiResponse({ status: 403, description: "Vous n'êtes pas participant à cette réunion" })
  cancelMeeting(
    @GetUser('id') participantId: string,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetingsService.cancelMeeting(participantId, meetingId);
  }

  /**
   * PATCH /meetings/:meetingId/reschedule
   */
  @Patch(':meetingId/reschedule')
  @ApiOperation({
    summary: '5.3 — Reprogrammer une réunion (nouveau créneau)',
    description:
      "Disponible uniquement sur réunions CONFIRMED. Vérifie que le nouveau créneau est libre pour les deux participants.",
  })
  @ApiParam({ name: 'meetingId', description: 'UUID de la réunion à reprogrammer' })
  @ApiResponse({ status: 200, description: 'Réunion reprogrammée avec succès' })
  @ApiResponse({ status: 400, description: 'Réunion non confirmée ou créneau invalide' })
  @ApiResponse({ status: 409, description: 'Nouveau créneau déjà occupé' })
  rescheduleMeeting(
    @GetUser('id') participantId: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: RescheduleMeetingDto,
  ) {
    return this.meetingsService.rescheduleMeeting(participantId, meetingId, dto.newSlotId);
  }

  /**
   * POST /meetings/:meetingId/rate
   */
  @Post(':meetingId/rate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '5.4 — Évaluer une réunion terminée',
    description:
      "Chaque participant évalue la réunion indépendamment. La note est privée et définitive.",
  })
  @ApiParam({ name: 'meetingId', description: 'UUID de la réunion à évaluer' })
  @ApiResponse({ status: 201, description: 'Évaluation enregistrée' })
  @ApiResponse({ status: 400, description: 'Réunion non terminée' })
  @ApiResponse({ status: 409, description: 'Réunion déjà évaluée' })
  rateMeeting(
    @GetUser('id') participantId: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: RateMeetingDto,
  ) {
    return this.meetingsService.rateMeeting(participantId, meetingId, dto);
  }
}