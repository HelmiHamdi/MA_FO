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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
} from './dto';

@ApiTags('B2B Meetings Module')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meetings')
export class MeetingsController {
  constructor(private meetingsService: MeetingsService) {}

  // ─── 5.1 MEETING REQUEST FLOW ────────────────

  @Get('slots/available')
  @ApiOperation({ summary: '5.1 Créneaux disponibles mutuellement entre deux participants' })
  getAvailableSlots(
    @GetUser('id') requesterId: string,
    @Query() query: GetSlotsQueryDto,
  ) {
    return this.meetingsService.getAvailableSlots(requesterId, query.receiverId);
  }

  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '5.1 Envoyer une demande de réunion' })
  requestMeeting(@GetUser('id') requesterId: string, @Body() dto: RequestMeetingDto) {
    return this.meetingsService.requestMeeting(requesterId, dto);
  }

  // ─── 5.2 IN-CHAT MEET REQUEST CARD ───────────

  @Patch(':meetingId/respond')
  @ApiOperation({ summary: '5.2 Accepter ou refuser une demande de réunion (carte in-chat)' })
  respondToMeeting(
    @GetUser('id') participantId: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: RespondMeetingDto,
  ) {
    return this.meetingsService.respondToMeeting(participantId, meetingId, dto);
  }

  // ─── 5.3 MY AGENDA ───────────────────────────

  @Get('agenda')
  @ApiOperation({ summary: '5.3 Mon agenda — toutes mes réunions groupées par jour' })
  getMyAgenda(@GetUser('id') participantId: string) {
    return this.meetingsService.getMyAgenda(participantId);
  }

  @Patch(':meetingId/cancel')
  @ApiOperation({ summary: '5.3 Annuler une réunion confirmée' })
  cancelMeeting(
    @GetUser('id') participantId: string,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetingsService.cancelMeeting(participantId, meetingId);
  }

  @Patch(':meetingId/reschedule')
  @ApiOperation({ summary: '5.3 Reprogrammer une réunion — nouveau créneau' })
  rescheduleMeeting(
    @GetUser('id') participantId: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: RescheduleMeetingDto,
  ) {
    return this.meetingsService.rescheduleMeeting(participantId, meetingId, dto.newSlotId);
  }

  // ─── 5.4 POST-MEETING RATING ─────────────────

  @Post(':meetingId/rate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '5.4 Évaluer une réunion terminée (1-5 étoiles, commentaire optionnel)' })
  rateMeeting(
    @GetUser('id') participantId: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: RateMeetingDto,
  ) {
    return this.meetingsService.rateMeeting(participantId, meetingId, dto);
  }

  // ─── 5.5 PHYSICAL TABLE QR ───────────────────

  @Post('confirm-table-qr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '5.5 Scanner le QR de la table physique pour confirmer la présence' })
  confirmTableQr(@GetUser('id') participantId: string, @Body() dto: ScanTableQrDto) {
    return this.meetingsService.confirmTableQr(participantId, dto);
  }

  // ─── AI MESSAGE GENERATOR ────────────────────

  @Get('generate-message/:receiverId')
  @ApiOperation({ summary: 'Générer un message de demande de réunion IA personnalisé' })
  async generateMessage(
    @GetUser() requester: any,
    @Param('receiverId') receiverId: string,
  ) {
    const { PrismaService } = require('../prisma/prisma.service');
    // Fetch receiver profile via service injection handled by DI
    return { message: 'Use POST /meetings/request without message field to auto-generate' };
  }
}