// src/meetings/meetings.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { MeetingStatus } from '@prisma/client';
import OpenAI from 'openai';

@Injectable()
export class MeetingsService {
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notifications: NotificationsService,
  ) {
    this.openai = new OpenAI({ apiKey: config.get('OPENAI_API_KEY') });
  }

  // ─────────────────────────────────────────────
  // 5.1 MEETING REQUEST FLOW
  // ─────────────────────────────────────────────

  /**
   * Récupère les créneaux disponibles mutuellement entre deux participants.
   */
  async getAvailableSlots(requesterId: string, receiverId: string) {
    if (requesterId === receiverId) {
      throw new BadRequestException('Impossible de planifier une réunion avec vous-même');
    }

    // Verify connection exists
    const connection = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { participantAId: requesterId, participantBId: receiverId },
          { participantAId: receiverId, participantBId: requesterId },
        ],
        status: 'ACCEPTED',
      },
    });

    if (!connection) {
      throw new ForbiddenException('Vous devez être connecté avec ce participant pour demander une réunion');
    }

    // Get already booked slot IDs for both participants
    const bookedSlotIds = await this.getBookedSlotIds([requesterId, receiverId]);

    // Get available mutual slots
    const slots = await this.prisma.timeSlot.findMany({
      where: {
        id: { notIn: bookedSlotIds },
        isAvailable: true,
        startTime: { gte: new Date() },
      },
      include: { table: true },
      orderBy: { startTime: 'asc' },
    });

    if (slots.length === 0) {
      return {
        available: false,
        message: 'Aucun créneau disponible. Veuillez contacter l\'organisateur.',
        slots: [],
      };
    }

    // Group by day
    const slotsByDay = slots.reduce<Record<string, any[]>>((acc, slot) => {
      const day = slot.startTime.toISOString().split('T')[0];
      if (!acc[day]) acc[day] = [];
      acc[day].push({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        table: slot.table ? { number: slot.table.number, room: slot.table.room } : null,
      });
      return acc;
    }, {});

    return { available: true, slotsByDay, totalAvailable: slots.length };
  }

  /**
   * Crée une demande de réunion (5.1).
   * Génère le message IA si non fourni, assigne la table, notifie le récepteur.
   */
  async requestMeeting(requesterId: string, dto: { receiverId: string; slotId: string; message?: string }) {
    const [requester, receiver, slot] = await Promise.all([
      this.prisma.participant.findUnique({ where: { id: requesterId } }),
      this.prisma.participant.findUnique({ where: { id: dto.receiverId } }),
      this.prisma.timeSlot.findUnique({ where: { id: dto.slotId }, include: { table: true } }),
    ]);

    if (!receiver) throw new NotFoundException('Participant récepteur introuvable');
    if (!slot) throw new NotFoundException('Créneau introuvable');
    if (!slot.isAvailable) throw new ConflictException('Ce créneau n\'est plus disponible');

    // Verify connection
    const connection = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { participantAId: requesterId, participantBId: dto.receiverId },
          { participantAId: dto.receiverId, participantBId: requesterId },
        ],
        status: 'ACCEPTED',
      },
    });

    if (!connection) {
      throw new ForbiddenException('Connexion requise pour demander une réunion');
    }

    // Check slot availability for both participants
    const bookedSlots = await this.getBookedSlotIds([requesterId, dto.receiverId]);
    if (bookedSlots.includes(dto.slotId)) {
      throw new ConflictException('Ce créneau est déjà pris par l\'un des participants');
    }

    // Generate or use provided message
    let requestMessage = dto.message;
    if (!requestMessage) {
      // Use participant's custom message or generate with GPT-4o
      requestMessage = requester.meetingMessage || (await this.generateMeetingMessage(requester, receiver));
    }

    // Create meeting
    const meeting = await this.prisma.meeting.create({
      data: {
        requesterId,
        receiverId: dto.receiverId,
        slotId: dto.slotId,
        tableId: slot.tableId,
        status: MeetingStatus.PENDING,
        requestMessage,
      },
      include: { slot: true, table: true, requester: true, receiver: true },
    });

    // Notify receiver (push + SMS + email via notifications service)
    await this.notifications.createInAppNotification({
      participantId: dto.receiverId,
      type: 'MEETING_REQUEST_RECEIVED',
      title: 'Nouvelle demande de réunion',
      body: `${requester.firstName} ${requester.lastName} souhaite vous rencontrer`,
      deepLink: `/chat/${connection.id}`,
      metadata: JSON.stringify({ meetingId: meeting.id, requesterId }),
    });

    await this.notifications.sendPushNotification(dto.receiverId, {
      title: 'Nouvelle demande de réunion',
      body: `${requester.firstName} souhaite vous rencontrer`,
    });

    return this.formatMeeting(meeting);
  }

  // ─────────────────────────────────────────────
  // 5.2 IN-CHAT MEET REQUEST CARD — ACCEPT/REFUSE
  // ─────────────────────────────────────────────

  async respondToMeeting(participantId: string, meetingId: string, dto: { action: 'CONFIRMED' | 'CANCELLED'; reason?: string }) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { slot: true, table: true, requester: true, receiver: true },
    });

    if (!meeting) throw new NotFoundException('Réunion introuvable');
    if (meeting.receiverId !== participantId) {
      throw new ForbiddenException('Vous n\'êtes pas autorisé à répondre à cette demande');
    }
    if (meeting.status !== MeetingStatus.PENDING) {
      throw new BadRequestException('Cette demande a déjà été traitée');
    }
    if (meeting.createdBy === 'ADMIN') {
      throw new ForbiddenException('Les réunions créées par l\'admin ne peuvent pas être refusées ici');
    }

    const newStatus = dto.action === 'CONFIRMED' ? MeetingStatus.CONFIRMED : MeetingStatus.CANCELLED;

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: newStatus,
        confirmedAt: dto.action === 'CONFIRMED' ? new Date() : undefined,
        cancelledAt: dto.action === 'CANCELLED' ? new Date() : undefined,
        refuseReason: dto.reason,
      },
      include: { slot: true, table: true, requester: true, receiver: true },
    });

    if (dto.action === 'CONFIRMED') {
      // Reserve the slot
      await this.prisma.timeSlot.update({
        where: { id: meeting.slotId },
        data: { isAvailable: false },
      });

      // Notify requester — confirmed
      await this.notifications.createInAppNotification({
        participantId: meeting.requesterId,
        type: 'MEETING_CONFIRMED',
        title: 'Réunion confirmée ! ✅',
        body: `${meeting.receiver.firstName} a accepté votre demande — Table ${meeting.table?.number}, Salle ${meeting.table?.room}`,
        deepLink: '/agenda',
        metadata: JSON.stringify({ meetingId }),
      });

      await this.notifications.sendPushNotification(meeting.requesterId, {
        title: 'Réunion confirmée !',
        body: `${meeting.receiver.firstName} a accepté — Table ${meeting.table?.number}`,
      });

      // Schedule meeting reminder (10 min before)
      // In production: use a queue/scheduler (BullMQ)
    } else {
      // Notify requester — refused
      await this.notifications.createInAppNotification({
        participantId: meeting.requesterId,
        type: 'MEETING_REFUSED',
        title: 'Réunion refusée',
        body: `${meeting.receiver.firstName} n'est pas disponible pour cette réunion`,
        deepLink: `/chat/${meetingId}`,
        metadata: JSON.stringify({ meetingId }),
      });

      await this.notifications.sendPushNotification(meeting.requesterId, {
        title: 'Réunion refusée',
        body: `${meeting.receiver.firstName} n'a pas pu accepter`,
      });
    }

    return this.formatMeeting(updated);
  }

  // ─────────────────────────────────────────────
  // 5.3 MY AGENDA
  // ─────────────────────────────────────────────

  async getMyAgenda(participantId: string) {
    const meetings = await this.prisma.meeting.findMany({
      where: {
        OR: [{ requesterId: participantId }, { receiverId: participantId }],
        status: { not: MeetingStatus.CANCELLED },
      },
      include: {
        slot: true,
        table: true,
        requester: { select: { id: true, firstName: true, lastName: true, company: true, photoUrl: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, company: true, photoUrl: true } },
        ratings: { where: { raterId: participantId }, select: { stars: true, isSubmitted: true } },
      },
      orderBy: { slot: { startTime: 'asc' } },
    });

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Group by day
    const byDay: Record<string, any[]> = {};

    for (const m of meetings) {
      const slotDay = m.slot?.startTime?.toISOString().split('T')[0] ?? 'unknown';
      if (!byDay[slotDay]) byDay[slotDay] = [];

      const otherParticipant = m.requesterId === participantId ? m.receiver : m.requester;
      const isUpcoming = m.slot?.startTime > now;
      const isPast = m.slot?.endTime < now;
      const hasRated = m.ratings[0]?.isSubmitted ?? false;

      byDay[slotDay].push({
        id: m.id,
        status: m.status,
        createdBy: m.createdBy,
        otherParticipant,
        slot: m.slot ? { startTime: m.slot.startTime, endTime: m.slot.endTime } : null,
        table: m.table ? { number: m.table.number, room: m.table.room } : null,
        isUpcoming,
        isPast,
        needsRating: isPast && m.status === MeetingStatus.COMPLETED && !hasRated,
        canCancel: m.status === MeetingStatus.CONFIRMED && isUpcoming,
        canReschedule: m.status === MeetingStatus.CONFIRMED && isUpcoming,
        canScanQr: m.status === MeetingStatus.CONFIRMED && isUpcoming,
        conversationId: m.conversationId,
      });
    }

    // Next meeting with countdown
    const upcomingMeetings = meetings.filter(
      (m) => m.slot?.startTime > now && m.status === MeetingStatus.CONFIRMED,
    );
    const nextMeeting = upcomingMeetings[0] ?? null;

    return {
      byDay,
      nextMeeting: nextMeeting
        ? {
            ...this.formatMeeting(nextMeeting),
            countdownMs: nextMeeting.slot.startTime.getTime() - now.getTime(),
          }
        : null,
    };
  }

  /**
   * Annuler une réunion.
   */
  async cancelMeeting(participantId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { slot: true, requester: true, receiver: true },
    });

    if (!meeting) throw new NotFoundException('Réunion introuvable');

    const isParticipant = meeting.requesterId === participantId || meeting.receiverId === participantId;
    if (!isParticipant) throw new ForbiddenException('Accès refusé');
    if (meeting.status === MeetingStatus.CANCELLED) throw new BadRequestException('Réunion déjà annulée');
    if (meeting.status === MeetingStatus.COMPLETED) throw new BadRequestException('Impossible d\'annuler une réunion terminée');

    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.CANCELLED, cancelledAt: new Date() },
    });

    // Free the slot
    if (meeting.slotId) {
      await this.prisma.timeSlot.update({
        where: { id: meeting.slotId },
        data: { isAvailable: true },
      });
    }

    const otherParticipantId = meeting.requesterId === participantId ? meeting.receiverId : meeting.requesterId;
    const canceller = meeting.requesterId === participantId ? meeting.requester : meeting.receiver;

    // Notify the other participant
    await this.notifications.createInAppNotification({
      participantId: otherParticipantId,
      type: 'MEETING_CANCELLED',
      title: 'Réunion annulée',
      body: `${canceller.firstName} ${canceller.lastName} a annulé la réunion`,
      deepLink: '/agenda',
      metadata: JSON.stringify({ meetingId }),
    });

    await this.notifications.sendPushNotification(otherParticipantId, {
      title: 'Réunion annulée',
      body: `${canceller.firstName} a annulé votre réunion`,
    });

    return { message: 'Réunion annulée avec succès', meetingId };
  }

  /**
   * Reprogrammer une réunion vers un nouveau créneau.
   */
  async rescheduleMeeting(participantId: string, meetingId: string, newSlotId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { slot: true, requester: true, receiver: true },
    });

    if (!meeting) throw new NotFoundException('Réunion introuvable');

    const isParticipant = meeting.requesterId === participantId || meeting.receiverId === participantId;
    if (!isParticipant) throw new ForbiddenException('Accès refusé');
    if (meeting.status !== MeetingStatus.CONFIRMED) throw new BadRequestException('Seules les réunions confirmées peuvent être reprogrammées');

    const newSlot = await this.prisma.timeSlot.findUnique({ where: { id: newSlotId }, include: { table: true } });
    if (!newSlot || !newSlot.isAvailable) throw new ConflictException('Le nouveau créneau n\'est pas disponible');

    // Check availability for both
    const otherParticipantId = meeting.requesterId === participantId ? meeting.receiverId : meeting.requesterId;
    const bookedSlots = await this.getBookedSlotIds([participantId, otherParticipantId]);
    if (bookedSlots.includes(newSlotId)) throw new ConflictException('Ce créneau est déjà pris');

    // Free old slot
    if (meeting.slotId) {
      await this.prisma.timeSlot.update({ where: { id: meeting.slotId }, data: { isAvailable: true } });
    }

    // Reserve new slot
    await this.prisma.timeSlot.update({ where: { id: newSlotId }, data: { isAvailable: false } });

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { slotId: newSlotId, tableId: newSlot.tableId, status: MeetingStatus.RESCHEDULED },
      include: { slot: true, table: true, requester: true, receiver: true },
    });

    const rescheduler = meeting.requesterId === participantId ? meeting.requester : meeting.receiver;

    // Notify both
    for (const pid of [meeting.requesterId, meeting.receiverId]) {
      if (pid === participantId) continue;
      await this.notifications.createInAppNotification({
        participantId: pid,
        type: 'MEETING_RESCHEDULED',
        title: 'Réunion reprogrammée',
        body: `${rescheduler.firstName} a reprogrammé la réunion au ${newSlot.startTime.toLocaleString('fr-FR')}`,
        deepLink: '/agenda',
        metadata: JSON.stringify({ meetingId }),
      });
      await this.notifications.sendPushNotification(pid, {
        title: 'Réunion reprogrammée',
        body: `Nouvelle heure: ${newSlot.startTime.toLocaleString('fr-FR')}`,
      });
    }

    return this.formatMeeting(updated);
  }

  // ─────────────────────────────────────────────
  // 5.4 POST-MEETING RATING
  // ─────────────────────────────────────────────

  async rateMeeting(participantId: string, meetingId: string, dto: { stars: number; comment?: string }) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { requester: true, receiver: true },
    });

    if (!meeting) throw new NotFoundException('Réunion introuvable');

    const isParticipant = meeting.requesterId === participantId || meeting.receiverId === participantId;
    if (!isParticipant) throw new ForbiddenException('Accès refusé');
    if (meeting.status !== MeetingStatus.COMPLETED) throw new BadRequestException('Seules les réunions terminées peuvent être évaluées');

    // Check existing rating
    const existingRating = await this.prisma.meetingRating.findUnique({
      where: { meetingId_raterId: { meetingId, raterId: participantId } },
    });

    if (existingRating?.isSubmitted) {
      throw new ConflictException('Vous avez déjà évalué cette réunion');
    }

    const rating = await this.prisma.meetingRating.upsert({
      where: { meetingId_raterId: { meetingId, raterId: participantId } },
      create: {
        meetingId,
        raterId: participantId,
        stars: dto.stars,
        comment: dto.comment,
        isSubmitted: true,
      },
      update: {
        stars: dto.stars,
        comment: dto.comment,
        isSubmitted: true,
      },
    });

    return { message: 'Évaluation enregistrée avec succès', ratingId: rating.id };
  }

  // ─────────────────────────────────────────────
  // 5.5 PHYSICAL TABLE QR CONFIRMATION
  // ─────────────────────────────────────────────

  async confirmTableQr(participantId: string, dto: { qrToken: string; meetingId: string }) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: dto.meetingId },
      include: { table: true, slot: true },
    });

    if (!meeting) throw new NotFoundException('Réunion introuvable');

    const isParticipant = meeting.requesterId === participantId || meeting.receiverId === participantId;
    if (!isParticipant) throw new ForbiddenException('Accès refusé');
    if (meeting.status !== MeetingStatus.CONFIRMED) throw new BadRequestException('La réunion doit être confirmée avant le scan');

    // Validate QR token matches assigned table
    const table = await this.prisma.table.findUnique({ where: { qrToken: dto.qrToken } });

    if (!table) {
      throw new BadRequestException('QR code de table non reconnu');
    }

    if (table.id !== meeting.tableId) {
      throw new BadRequestException(
        `Ce n'est pas votre table assignée. Votre table: Table ${meeting.table?.number}, Salle ${meeting.table?.room}`,
      );
    }

    // Update meeting to completed
    await this.prisma.meeting.update({
      where: { id: dto.meetingId },
      data: {
        status: MeetingStatus.COMPLETED,
        completedAt: new Date(),
        qrConfirmedBy: participantId,
        qrConfirmedAt: new Date(),
      },
    });

    // Trigger post-meeting rating prompt for both participants
    for (const pid of [meeting.requesterId, meeting.receiverId]) {
      await this.notifications.createInAppNotification({
        participantId: pid,
        type: 'POST_MEETING_RATING',
        title: 'Comment s\'est passée votre réunion ?',
        body: 'Prenez 30 secondes pour évaluer votre rencontre',
        deepLink: `/agenda/rate/${meeting.id}`,
        metadata: JSON.stringify({ meetingId: meeting.id }),
      });

      await this.notifications.sendPushNotification(pid, {
        title: 'Évaluez votre réunion ⭐',
        body: 'Donnez votre avis sur cette rencontre',
      });
    }

    return {
      message: 'Présence confirmée. Bonne réunion !',
      meetingId: dto.meetingId,
      status: MeetingStatus.COMPLETED,
    };
  }

  // ─────────────────────────────────────────────
  // AI MEETING MESSAGE GENERATOR
  // ─────────────────────────────────────────────

  async generateMeetingMessage(requester: any, receiver: any): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Tu es un assistant B2B. Génère un court message de demande de réunion professionnel et personnalisé (max 3 phrases), en français, de la part du demandeur vers le destinataire.',
          },
          {
            role: 'user',
            content: `Demandeur: ${requester.firstName} ${requester.lastName}, ${requester.jobTitle} chez ${requester.company}, secteur: ${requester.sector}
Destinataire: ${receiver.firstName} ${receiver.lastName}, ${receiver.jobTitle} chez ${receiver.company}, secteur: ${receiver.sector}`,
          },
        ],
        max_tokens: 150,
        temperature: 0.8,
      });
      return completion.choices[0].message.content;
    } catch {
      return `Bonjour ${receiver.firstName}, je serais ravi d'échanger avec vous lors de cet événement. Seriez-vous disponible pour une réunion ?`;
    }
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private async getBookedSlotIds(participantIds: string[]): Promise<string[]> {
    const bookedMeetings = await this.prisma.meeting.findMany({
      where: {
        OR: [
          { requesterId: { in: participantIds } },
          { receiverId: { in: participantIds } },
        ],
        status: { in: [MeetingStatus.PENDING, MeetingStatus.CONFIRMED] },
        slotId: { not: null },
      },
      select: { slotId: true },
    });
    return [...new Set(bookedMeetings.map((m) => m.slotId).filter(Boolean))];
  }

  private formatMeeting(m: any) {
    return {
      id: m.id,
      status: m.status,
      createdBy: m.createdBy,
      requestMessage: m.requestMessage,
      confirmedAt: m.confirmedAt,
      cancelledAt: m.cancelledAt,
      completedAt: m.completedAt,
      slot: m.slot ? { id: m.slot.id, startTime: m.slot.startTime, endTime: m.slot.endTime } : null,
      table: m.table ? { number: m.table.number, room: m.table.room } : null,
      requester: m.requester
        ? {
            id: m.requester.id,
            firstName: m.requester.firstName,
            lastName: m.requester.lastName,
            company: m.requester.company,
            photoUrl: m.requester.photoUrl,
          }
        : null,
      receiver: m.receiver
        ? {
            id: m.receiver.id,
            firstName: m.receiver.firstName,
            lastName: m.receiver.lastName,
            company: m.receiver.company,
            photoUrl: m.receiver.photoUrl,
          }
        : null,
    };
  }
}