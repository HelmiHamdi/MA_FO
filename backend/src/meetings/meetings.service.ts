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
import { MeetingStatus, MeetingCreatedBy } from '@prisma/client';
import OpenAI from 'openai';
import {
  RequestMeetingDto,
  RespondMeetingDto,
  RateMeetingDto,
  ScanTableQrDto,
  AdminCreateMeetingDto,
} from './dto';

@Injectable()
export class MeetingsService {
  private openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,

  ) {
    this.openai = new OpenAI({ apiKey: config.get('OPENAI_API_KEY') });
  }

  // ═════════════════════════════════════════════════════════════
  // 5.1 MEETING REQUEST FLOW
  // ═════════════════════════════════════════════════════════════

  async getAvailableSlots(requesterId: string, receiverId: string) {
    if (!receiverId) {
      throw new BadRequestException('receiverId est requis');
    }

    if (requesterId === receiverId) {
      throw new BadRequestException('Impossible de planifier une réunion avec vous-même');
    }

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
      throw new ForbiddenException(
        'Vous devez être connecté avec ce participant pour demander une réunion',
      );
    }

    const bookedSlotIds = await this.getBookedSlotIds([requesterId, receiverId]);

    const slots = await this.prisma.timeSlot.findMany({
      where: {
        id: { notIn: bookedSlotIds.length ? bookedSlotIds : ['__none__'] },
        isAvailable: true,
        startTime: { gte: new Date() },
      },
      include: { table: true },
      orderBy: { startTime: 'asc' },
    });

    if (slots.length === 0) {
      return {
        available: false,
        message:
          "Aucun créneau disponible en commun. Veuillez contacter l'organisateur de l'événement.",
        slots: [],
        slotsByDay: {},
      };
    }

    const slotsByDay = slots.reduce<Record<string, any[]>>((acc, slot) => {
      const day = slot.startTime.toISOString().split('T')[0];
      if (!acc[day]) acc[day] = [];
      acc[day].push({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        table: slot.table
          ? { id: slot.table.id, number: slot.table.number, room: slot.table.room }
          : null,
        isAvailable: slot.isAvailable,
      });
      return acc;
    }, {});

    return {
      available: true,
      slotsByDay,
      totalAvailable: slots.length,
    };
  }

  async requestMeeting(requesterId: string, dto: RequestMeetingDto) {
    const [requester, receiver, slot] = await Promise.all([
      this.prisma.participant.findUnique({ where: { id: requesterId } }),
      this.prisma.participant.findUnique({ where: { id: dto.receiverId } }),
      this.prisma.timeSlot.findUnique({
        where: { id: dto.slotId },
        include: { table: true },
      }),
    ]);

    if (!receiver) throw new NotFoundException('Participant récepteur introuvable');
    if (!slot) throw new NotFoundException('Créneau introuvable');
    if (!slot.isAvailable) throw new ConflictException("Ce créneau n'est plus disponible");
    if (slot.startTime < new Date()) {
      throw new BadRequestException('Impossible de réserver un créneau passé');
    }

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
      throw new ForbiddenException('Connexion ACCEPTED requise pour demander une réunion');
    }

    const bookedSlots = await this.getBookedSlotIds([requesterId, dto.receiverId]);
    if (bookedSlots.includes(dto.slotId)) {
      throw new ConflictException(
        "Ce créneau est déjà réservé par l'un des deux participants",
      );
    }

    let requestMessage = dto.message;
    if (!requestMessage) {
      requestMessage =
        (requester as any)?.meetingMessage ||
        (await this.generateMeetingMessage(requester, receiver));
    }

    const meeting = await this.prisma.meeting.create({
      data: {
        requesterId,
        receiverId: dto.receiverId,
        slotId: dto.slotId,
        tableId: slot.tableId ?? null,
        status: MeetingStatus.PENDING,
        createdBy: MeetingCreatedBy.PARTICIPANT,
        requestMessage,
        conversationId: connection.id,
      },
      include: {
        slot: true,
        table: true,
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            jobTitle: true,
            photoUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            jobTitle: true,
            photoUrl: true,
          },
        },
      },
    });

    await Promise.all([
      this.notifications.createInAppNotification({
        participantId: dto.receiverId,
        type: 'MEETING_REQUEST_RECEIVED',
        title: 'Nouvelle demande de réunion',
        body: `${requester.firstName} ${requester.lastName} souhaite vous rencontrer`,
        deepLink: `/chat/${connection.id}`,
        metadata: JSON.stringify({
          meetingId: meeting.id,
          requesterId,
          slotId: dto.slotId,
        }),
      }),
      this.notifications.sendPushNotification(dto.receiverId, {
        title: '📅 Nouvelle demande de réunion',
        body: `${requester.firstName} souhaite vous rencontrer`,
      }),
    ]);

    return this.formatMeeting(meeting);
  }

  // ═════════════════════════════════════════════════════════════
  // 5.2 IN-CHAT MEET REQUEST CARD — ACCEPT / REFUSE
  // ═════════════════════════════════════════════════════════════

  async respondToMeeting(
    participantId: string,
    meetingId: string,
    dto: RespondMeetingDto,
  ) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        slot: true,
        table: true,
        requester: {
          select: { id: true, firstName: true, lastName: true, company: true, photoUrl: true },
        },
        receiver: {
          select: { id: true, firstName: true, lastName: true, company: true, photoUrl: true },
        },
      },
    });

    if (!meeting) throw new NotFoundException('Réunion introuvable');

    // ✅ FIX BUG #2 — vérifier ADMIN en premier (ordre logique, élimine le code mort)
    if (meeting.createdBy === MeetingCreatedBy.ADMIN) {
      throw new ForbiddenException(
        "Les réunions créées par l'administrateur ne peuvent pas être modifiées via cette interface",
      );
    }

    if (meeting.receiverId !== participantId) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à répondre à cette demande");
    }

    if (meeting.status !== MeetingStatus.PENDING) {
      throw new BadRequestException(
        `Cette demande a déjà été traitée (statut actuel: ${meeting.status})`,
      );
    }

    const isAccepted = dto.action === 'CONFIRMED';
    const newStatus = isAccepted ? MeetingStatus.CONFIRMED : MeetingStatus.CANCELLED;

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: newStatus,
        confirmedAt: isAccepted ? new Date() : undefined,
        cancelledAt: !isAccepted ? new Date() : undefined,
        refuseReason: dto.reason ?? null,
      },
      include: {
        slot: true,
        table: true,
        requester: {
          select: { id: true, firstName: true, lastName: true, company: true, photoUrl: true },
        },
        receiver: {
          select: { id: true, firstName: true, lastName: true, company: true, photoUrl: true },
        },
      },
    });

    if (isAccepted) {
      if (meeting.slotId) {
        await this.prisma.timeSlot.update({
          where: { id: meeting.slotId },
          data: { isAvailable: false },
        });
      }

      await Promise.all([
        this.notifications.createInAppNotification({
          participantId: meeting.requesterId,
          type: 'MEETING_CONFIRMED',
          title: '✅ Réunion confirmée !',
          body: `${meeting.receiver.firstName} a accepté votre demande — Table ${meeting.table?.number ?? '–'}, Salle ${meeting.table?.room ?? '–'}`,
         deepLink: '/meetings',
          metadata: JSON.stringify({
            meetingId,
            tableNumber: meeting.table?.number,
            tableRoom: meeting.table?.room,
          }),
        }),
        this.notifications.sendPushNotification(meeting.requesterId, {
          title: '✅ Réunion confirmée !',
          body: `${meeting.receiver.firstName} a accepté — Table ${meeting.table?.number ?? '–'}`,
        }),
      ]);
    } else {
      await Promise.all([
        this.notifications.createInAppNotification({
          participantId: meeting.requesterId,
          type: 'MEETING_REFUSED',
          title: 'Réunion déclinée',
          body: `${meeting.receiver.firstName} n'est pas disponible pour cette réunion`,
          deepLink: `/chat/${meeting.conversationId ?? meetingId}`,
          metadata: JSON.stringify({ meetingId, reason: dto.reason }),
        }),
        this.notifications.sendPushNotification(meeting.requesterId, {
          title: 'Réunion déclinée',
          body: `${meeting.receiver.firstName} n'a pas pu accepter cette réunion`,
        }),
      ]);
    }

    return this.formatMeeting(updated);
  }

  // ═════════════════════════════════════════════════════════════
  // 5.3 MY AGENDA
  // ═════════════════════════════════════════════════════════════

  async getMyAgenda(participantId: string) {
    const meetings = await this.prisma.meeting.findMany({
      where: {
        OR: [{ requesterId: participantId }, { receiverId: participantId }],
        status: { not: MeetingStatus.CANCELLED },
      },
      include: {
        slot: true,
        table: true,
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            jobTitle: true,
            photoUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            jobTitle: true,
            photoUrl: true,
          },
        },
        ratings: {
          where: { raterId: participantId },
          select: { stars: true, isSubmitted: true },
        },
      },
      orderBy: { slot: { startTime: 'asc' } },
    });

    const now = new Date();
    const byDay: Record<string, any[]> = {};

    for (const m of meetings) {
      const slotDay = m.slot?.startTime?.toISOString().split('T')[0] ?? 'unknown';
      if (!byDay[slotDay]) byDay[slotDay] = [];

      const otherParticipant =
        m.requesterId === participantId ? m.receiver : m.requester;

      const isUpcoming = !!m.slot?.startTime && m.slot.startTime > now;
      const isPast = !!m.slot?.endTime && m.slot.endTime < now;
      const hasRated = m.ratings[0]?.isSubmitted ?? false;

      byDay[slotDay].push({
        id: m.id,
        status: m.status,
        statusLabel: this.getStatusLabel(m.status),
        createdBy: m.createdBy,
        requestMessage: m.requestMessage,
        refuseReason: (m as any).refuseReason ?? null,
        otherParticipant,
        slot: m.slot
          ? {
              id: m.slot.id,
              startTime: m.slot.startTime,
              endTime: m.slot.endTime,
            }
          : null,
        table: m.table
          ? { number: m.table.number, room: m.table.room }
          : null,
        conversationId: m.conversationId,
        isUpcoming,
        isPast,
        needsRating: isPast && m.status === MeetingStatus.COMPLETED && !hasRated,
        // ✅ FIX BUG #4 — le requester peut annuler une demande PENDING
        canCancel:
          (m.status === MeetingStatus.CONFIRMED || m.status === MeetingStatus.PENDING) &&
          isUpcoming,
        // ✅ FIX BUG #3 — canReschedule accepte aussi RESCHEDULED
        canReschedule:
          (m.status === MeetingStatus.CONFIRMED ||
            m.status === MeetingStatus.RESCHEDULED) &&
          isUpcoming,
        canScanQr: m.status === MeetingStatus.CONFIRMED && isUpcoming,
        hasRated,
      });
    }

    const upcoming = meetings.filter(
      (m) =>
        m.slot?.startTime &&
        m.slot.startTime > now &&
        m.status === MeetingStatus.CONFIRMED,
    );
    const nextMeeting = upcoming[0] ?? null;

    return {
      byDay,
      totalMeetings: meetings.length,
      nextMeeting: nextMeeting
        ? {
            ...this.formatMeeting(nextMeeting),
            otherParticipant:
              nextMeeting.requesterId === participantId
                ? nextMeeting.receiver
                : nextMeeting.requester,
            countdownMs: nextMeeting.slot!.startTime.getTime() - now.getTime(),
          }
        : null,
    };
  }

  async cancelMeeting(participantId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        slot: true,
        requester: { select: { id: true, firstName: true, lastName: true } },
        receiver: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!meeting) throw new NotFoundException('Réunion introuvable');

    const isParticipant =
      meeting.requesterId === participantId || meeting.receiverId === participantId;

    if (!isParticipant) throw new ForbiddenException('Accès refusé');

    if (meeting.status === MeetingStatus.CANCELLED) {
      throw new BadRequestException('Cette réunion est déjà annulée');
    }
    if (meeting.status === MeetingStatus.COMPLETED) {
      throw new BadRequestException("Impossible d'annuler une réunion déjà terminée");
    }

    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.CANCELLED, cancelledAt: new Date() },
    });

    // Libérer le créneau uniquement si la réunion était CONFIRMED ou RESCHEDULED
    // (une réunion PENDING n'a pas encore bloqué le slot côté isAvailable=false)
    if (
      meeting.slotId &&
      (meeting.status === MeetingStatus.CONFIRMED ||
        meeting.status === MeetingStatus.RESCHEDULED)
    ) {
      await this.prisma.timeSlot.update({
        where: { id: meeting.slotId },
        data: { isAvailable: true },
      });
    }

    const otherParticipantId =
      meeting.requesterId === participantId ? meeting.receiverId : meeting.requesterId;

    const canceller =
      meeting.requesterId === participantId ? meeting.requester : meeting.receiver;

    await Promise.all([
      this.notifications.createInAppNotification({
        participantId: otherParticipantId,
        type: 'MEETING_CANCELLED',
        title: 'Réunion annulée',
        body: `${canceller.firstName} ${canceller.lastName} a annulé la réunion`,
        deepLink: '/meetings',
        metadata: JSON.stringify({ meetingId }),
      }),
      this.notifications.sendPushNotification(otherParticipantId, {
        title: 'Réunion annulée',
        body: `${canceller.firstName} a annulé votre réunion`,
      }),
    ]);

    return { success: true, message: 'Réunion annulée avec succès', meetingId };
  }

  async rescheduleMeeting(
    participantId: string,
    meetingId: string,
    newSlotId: string,
  ) {
    if (!newSlotId) {
      throw new BadRequestException('newSlotId est requis');
    }

    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        slot: true,
        requester: { select: { id: true, firstName: true, lastName: true } },
        receiver: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!meeting) throw new NotFoundException('Réunion introuvable');

    const isParticipant =
      meeting.requesterId === participantId || meeting.receiverId === participantId;

    if (!isParticipant) throw new ForbiddenException('Accès refusé');

    // ✅ FIX BUG #1 — accepter CONFIRMED et RESCHEDULED pour permettre plusieurs reports
    if (
      meeting.status !== MeetingStatus.CONFIRMED &&
      meeting.status !== MeetingStatus.RESCHEDULED
    ) {
      throw new BadRequestException(
        'Seules les réunions confirmées ou replanifiées peuvent être reprogrammées',
      );
    }

    const newSlot = await this.prisma.timeSlot.findUnique({
      where: { id: newSlotId },
      include: { table: true },
    });

    if (!newSlot) throw new NotFoundException('Nouveau créneau introuvable');
    if (!newSlot.isAvailable) {
      throw new ConflictException("Le nouveau créneau n'est pas disponible");
    }
    if (newSlot.startTime < new Date()) {
      throw new BadRequestException('Impossible de reprogrammer vers un créneau passé');
    }

    const otherParticipantId =
      meeting.requesterId === participantId ? meeting.receiverId : meeting.requesterId;

    const bookedSlots = await this.getBookedSlotIds([participantId, otherParticipantId]);

    if (bookedSlots.includes(newSlotId)) {
      throw new ConflictException(
        "Ce créneau est déjà occupé par l'un des deux participants",
      );
    }

    await this.prisma.$transaction([
      ...(meeting.slotId
        ? [
            this.prisma.timeSlot.update({
              where: { id: meeting.slotId },
              data: { isAvailable: true },
            }),
          ]
        : []),
      this.prisma.timeSlot.update({
        where: { id: newSlotId },
        data: { isAvailable: false },
      }),
      this.prisma.meeting.update({
        where: { id: meetingId },
        data: {
          slotId: newSlotId,
          tableId: newSlot.tableId ?? null,
          status: MeetingStatus.RESCHEDULED,
        },
      }),
    ]);

    const updated = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        slot: true,
        table: true,
        requester: { select: { id: true, firstName: true, lastName: true, company: true, photoUrl: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, company: true, photoUrl: true } },
      },
    });

    const rescheduler =
      meeting.requesterId === participantId ? meeting.requester : meeting.receiver;

    const formattedDate = newSlot.startTime.toLocaleString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });

    await Promise.all([
      this.notifications.createInAppNotification({
        participantId: otherParticipantId,
        type: 'MEETING_RESCHEDULED',
        title: '📅 Réunion reprogrammée',
        body: `${rescheduler.firstName} a déplacé la réunion au ${formattedDate}`,
        deepLink: '/meetings',
        metadata: JSON.stringify({ meetingId, newSlotId }),
      }),
      this.notifications.sendPushNotification(otherParticipantId, {
        title: 'Réunion reprogrammée',
        body: `Nouvelle heure: ${formattedDate}`,
      }),
    ]);

    return this.formatMeeting(updated);
  }

  // ═════════════════════════════════════════════════════════════
  // 5.4 POST-MEETING RATING
  // ═════════════════════════════════════════════════════════════

  async rateMeeting(
    participantId: string,
    meetingId: string,
    dto: RateMeetingDto,
  ) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        requester: { select: { id: true, firstName: true } },
        receiver: { select: { id: true, firstName: true } },
      },
    });

    if (!meeting) throw new NotFoundException('Réunion introuvable');

    const isParticipant =
      meeting.requesterId === participantId || meeting.receiverId === participantId;

    if (!isParticipant) throw new ForbiddenException('Accès refusé');

    if (meeting.status !== MeetingStatus.COMPLETED) {
      throw new BadRequestException(
        'Seules les réunions terminées (COMPLETED) peuvent être évaluées',
      );
    }

    const existingRating = await this.prisma.meetingRating.findUnique({
      where: {
        meetingId_raterId: { meetingId, raterId: participantId },
      },
    });

    if (existingRating?.isSubmitted) {
      throw new ConflictException('Vous avez déjà soumis une évaluation pour cette réunion');
    }

    const rating = await this.prisma.meetingRating.upsert({
      where: {
        meetingId_raterId: { meetingId, raterId: participantId },
      },
      create: {
        meetingId,
        raterId: participantId,
        stars: dto.stars,
        comment: dto.comment ?? null,
        isSubmitted: true,
      },
      update: {
        stars: dto.stars,
        comment: dto.comment ?? null,
        isSubmitted: true,
      },
    });

    return {
      success: true,
      message: 'Évaluation enregistrée avec succès',
      ratingId: rating.id,
      stars: rating.stars,
    };
  }

  // ═════════════════════════════════════════════════════════════
  // 5.5 PHYSICAL TABLE QR CONFIRMATION
  // ═════════════════════════════════════════════════════════════

  async confirmTableQr(participantId: string, dto: ScanTableQrDto) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: dto.meetingId },
      include: {
        table: true,
        slot: true,
        requester: { select: { id: true, firstName: true } },
        receiver: { select: { id: true, firstName: true } },
      },
    });

    if (!meeting) throw new NotFoundException('Réunion introuvable');

    const isParticipant =
      meeting.requesterId === participantId || meeting.receiverId === participantId;

    if (!isParticipant) throw new ForbiddenException('Accès refusé');

    if (meeting.status !== MeetingStatus.CONFIRMED) {
      throw new BadRequestException(
        'La réunion doit être en statut CONFIRMED avant le scan du QR',
      );
    }

    const scannedTable = await this.prisma.table.findUnique({
      where: { qrToken: dto.qrToken },
    });

    if (!scannedTable) {
      throw new BadRequestException(
        'QR code de table non reconnu. Assurez-vous de scanner le bon QR.',
      );
    }

    if (scannedTable.id !== meeting.tableId) {
      throw new BadRequestException(
        `Ce n'est pas votre table assignée. Votre table: Table ${meeting.table?.number ?? '–'}, Salle ${meeting.table?.room ?? '–'}`,
      );
    }

    await this.prisma.meeting.update({
      where: { id: dto.meetingId },
      data: {
        status: MeetingStatus.COMPLETED,
        completedAt: new Date(),
        qrConfirmedBy: participantId,
        qrConfirmedAt: new Date(),
      },
    });

    const participants = [meeting.requesterId, meeting.receiverId];
    await Promise.all(
      participants.flatMap((pid) => [
        this.notifications.createInAppNotification({
          participantId: pid,
          type: 'POST_MEETING_RATING',
          title: "Comment s'est passée votre réunion ? ⭐",
          body: 'Prenez 30 secondes pour évaluer cette rencontre',
          deepLink: `/meetings`,
          metadata: JSON.stringify({ meetingId: meeting.id }),
        }),
        this.notifications.sendPushNotification(pid, {
          title: 'Évaluez votre réunion ⭐',
          body: 'Donnez votre avis sur cette rencontre',
        }),
      ]),
    );

    return {
      success: true,
      message: 'Présence confirmée. Bonne réunion !',
      meetingId: dto.meetingId,
      status: MeetingStatus.COMPLETED,
      table: {
        number: scannedTable.number,
        room: meeting.table?.room ?? '–',
      },
    };
  }

  // ═════════════════════════════════════════════════════════════
  // ADMIN: CREATE MEETING
  // ═════════════════════════════════════════════════════════════

  async adminCreateMeeting(dto: AdminCreateMeetingDto) {
    const [requester, receiver, slot] = await Promise.all([
      this.prisma.participant.findUnique({ where: { id: dto.requesterId } }),
      this.prisma.participant.findUnique({ where: { id: dto.receiverId } }),
      this.prisma.timeSlot.findUnique({
        where: { id: dto.slotId },
        include: { table: true },
      }),
    ]);

    if (!requester) throw new NotFoundException('Participant requester introuvable');
    if (!receiver) throw new NotFoundException('Participant receiver introuvable');
    if (!slot) throw new NotFoundException('Créneau introuvable');
    if (!slot.isAvailable) throw new ConflictException('Créneau non disponible');

    const meeting = await this.prisma.meeting.create({
      data: {
        requesterId: dto.requesterId,
        receiverId: dto.receiverId,
        slotId: dto.slotId,
        tableId: slot.tableId ?? null,
        status: MeetingStatus.CONFIRMED,
        createdBy: MeetingCreatedBy.ADMIN,
        requestMessage:
          dto.requestMessage ?? "Réunion planifiée par l'organisateur de l'événement.",
        confirmedAt: new Date(),
      },
      include: {
        slot: true,
        table: true,
        requester: { select: { id: true, firstName: true, lastName: true, company: true, photoUrl: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, company: true, photoUrl: true } },
      },
    });

    await this.prisma.timeSlot.update({
      where: { id: dto.slotId },
      data: { isAvailable: false },
    });

    const tableInfo = slot.table
      ? `Table ${slot.table.number}, Salle ${slot.table.room}`
      : '';

    await Promise.all(
      [dto.requesterId, dto.receiverId].flatMap((pid) => {
        const other = pid === dto.requesterId ? receiver : requester;
        return [
          this.notifications.createInAppNotification({
            participantId: pid,
            type: 'MEETING_CONFIRMED',
            title: "📅 Réunion planifiée par l'organisateur",
            body: `Réunion avec ${other.firstName} ${other.lastName} — ${tableInfo}`,
           deepLink: '/meetings',
            metadata: JSON.stringify({ meetingId: meeting.id }),
          }),
          this.notifications.sendPushNotification(pid, {
            title: 'Réunion planifiée',
            body: `Réunion avec ${other.firstName} — ${tableInfo}`,
          }),
        ];
      }),
    );

    return this.formatMeeting(meeting);
  }

  // ═════════════════════════════════════════════════════════════
  // MEETING DETAIL
  // ═════════════════════════════════════════════════════════════

  async getMeetingById(participantId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        slot: true,
        table: true,
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            jobTitle: true,
            photoUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            jobTitle: true,
            photoUrl: true,
          },
        },
        ratings: {
          where: { raterId: participantId },
          select: { stars: true, comment: true, isSubmitted: true, createdAt: true },
        },
      },
    });

    if (!meeting) throw new NotFoundException('Réunion introuvable');

    const isParticipant =
      meeting.requesterId === participantId || meeting.receiverId === participantId;

    if (!isParticipant) {
      throw new ForbiddenException("Vous n'avez pas accès à cette réunion");
    }

    return {
      ...this.formatMeeting(meeting),
      myRating: meeting.ratings[0] ?? null,
      otherParticipant:
        meeting.requesterId === participantId ? meeting.receiver : meeting.requester,
    };
  }

  // ═════════════════════════════════════════════════════════════
  // AI MESSAGE GENERATOR
  // ═════════════════════════════════════════════════════════════

  async preGenerateMessageForSlotScreen(requesterId: string, receiverId: string) {
    const [requester, receiver] = await Promise.all([
      this.prisma.participant.findUnique({ where: { id: requesterId } }),
      this.prisma.participant.findUnique({ where: { id: receiverId } }),
    ]);

    if (!receiver) throw new NotFoundException('Participant introuvable');

    const message =
      (requester as any)?.meetingMessage ||
      (await this.generateMeetingMessage(requester, receiver));

    return { message, source: (requester as any)?.meetingMessage ? 'profile' : 'ai' };
  }

  async generateMeetingMessage(requester: any, receiver: any): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Tu es un assistant B2B événementiel. Génère un message de demande de réunion professionnel, personnalisé et chaleureux (max 3 phrases) en français. Le message doit sembler authentique et pertinent selon les profils.',
          },
          {
            role: 'user',
            content: `Demandeur: ${requester?.firstName ?? ''} ${requester?.lastName ?? ''}, ${requester?.jobTitle ?? 'Professionnel'} chez ${requester?.company ?? 'son entreprise'}, secteur: ${requester?.sector ?? 'non précisé'}
Destinataire: ${receiver?.firstName ?? ''} ${receiver?.lastName ?? ''}, ${receiver?.jobTitle ?? 'Professionnel'} chez ${receiver?.company ?? 'son entreprise'}, secteur: ${receiver?.sector ?? 'non précisé'}`,
          },
        ],
        max_tokens: 150,
        temperature: 0.8,
      });
      return (
        completion.choices[0]?.message?.content ?? this.getFallbackMessage(receiver)
      );
    } catch {
      return this.getFallbackMessage(receiver);
    }
  }

  private getFallbackMessage(receiver: any): string {
    return `Bonjour ${receiver?.firstName ?? ''},\n\nJe serais ravi(e) d'échanger avec vous lors de cet événement. Seriez-vous disponible pour une réunion ?`;
  }

  // ═════════════════════════════════════════════════════════════
  // HELPERS
  // ═════════════════════════════════════════════════════════════

  private async getBookedSlotIds(participantIds: string[]): Promise<string[]> {
    const booked = await this.prisma.meeting.findMany({
      where: {
        OR: [
          { requesterId: { in: participantIds } },
          { receiverId: { in: participantIds } },
        ],
        status: { in: [MeetingStatus.PENDING, MeetingStatus.CONFIRMED, MeetingStatus.RESCHEDULED] },
        slotId: { not: null },
      },
      select: { slotId: true },
    });

    return [
      ...new Set(booked.map((m) => m.slotId).filter(Boolean) as string[]),
    ];
  }

  private getStatusLabel(status: MeetingStatus): string {
    const labels: Record<MeetingStatus, string> = {
      PENDING: 'En attente',
      CONFIRMED: 'Confirmée',
      CANCELLED: 'Annulée',
      COMPLETED: 'Terminée',
      RESCHEDULED: 'Replanifiée',
    };
    return labels[status] ?? status;
  }

  private formatMeeting(m: any) {
    return {
      id: m.id,
      status: m.status,
      statusLabel: this.getStatusLabel(m.status),
      createdBy: m.createdBy,
      requestMessage: m.requestMessage,
      refuseReason: m.refuseReason ?? null,
      confirmedAt: m.confirmedAt ?? null,
      cancelledAt: m.cancelledAt ?? null,
      completedAt: m.completedAt ?? null,
      qrConfirmedAt: m.qrConfirmedAt ?? null,
      conversationId: m.conversationId ?? null,
      slot: m.slot
        ? {
            id: m.slot.id,
            startTime: m.slot.startTime,
            endTime: m.slot.endTime,
          }
        : null,
      table: m.table ? { number: m.table.number, room: m.table.room } : null,
      requester: m.requester
        ? {
            id: m.requester.id,
            firstName: m.requester.firstName,
            lastName: m.requester.lastName,
            company: m.requester.company ?? null,
            jobTitle: m.requester.jobTitle ?? null,
            photoUrl: m.requester.photoUrl ?? null,
          }
        : null,
      receiver: m.receiver
        ? {
            id: m.receiver.id,
            firstName: m.receiver.firstName,
            lastName: m.receiver.lastName,
            company: m.receiver.company ?? null,
            jobTitle: m.receiver.jobTitle ?? null,
            photoUrl: m.receiver.photoUrl ?? null,
          }
        : null,
    };
  }
}