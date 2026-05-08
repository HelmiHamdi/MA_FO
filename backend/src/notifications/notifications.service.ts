// src/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import * as webpush from 'web-push';

interface CreateNotificationDto {
  participantId: string;
  type: keyof typeof NotificationType;
  title: string;
  body: string;
  deepLink?: string;
  metadata?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    webpush.setVapidDetails(
      config.get<string>('VAPID_SUBJECT'),
      config.get<string>('VAPID_PUBLIC_KEY'),
      config.get<string>('VAPID_PRIVATE_KEY'),
    );
  }

  // ─────────────────────────────────────────────
  // IN-APP NOTIFICATION CENTER
  // ─────────────────────────────────────────────

  async createInAppNotification(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        participantId: dto.participantId,
        type: dto.type as NotificationType,
        title: dto.title,
        body: dto.body,
        deepLink: dto.deepLink,
        metadata: dto.metadata,
      },
    });
  }

  async getNotifications(participantId: string, page = 1, limit = 20, type?: string) {
    const skip = (page - 1) * limit;
    const where: any = { participantId };
    if (type) where.type = type;

    const [total, notifications] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: { participantId, isRead: false },
    });

    return {
      data: notifications,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markAsRead(participantId: string, notificationId?: string) {
    if (notificationId) {
      return this.prisma.notification.updateMany({
        where: { id: notificationId, participantId },
        data: { isRead: true },
      });
    }
    return this.prisma.notification.updateMany({
      where: { participantId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(participantId: string) {
    const count = await this.prisma.notification.count({
      where: { participantId, isRead: false },
    });
    return { unreadCount: count };
  }

  // ─────────────────────────────────────────────
  // PUSH NOTIFICATION SERVICE
  // ─────────────────────────────────────────────

  async registerPushSubscription(participantId: string, subscription: object) {
    await this.prisma.participant.update({
      where: { id: participantId },
      data: { pushSubscription: JSON.stringify(subscription) },
    });
    return { message: 'Abonnement push enregistré' };
  }

  async sendPushNotification(
    participantId: string,
    payload: { title: string; body: string; deepLink?: string },
  ) {
    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
      select: { pushSubscription: true },
    });

    if (!participant?.pushSubscription) return;

    try {
      const subscription = JSON.parse(participant.pushSubscription);
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          data: { deepLink: payload.deepLink },
        }),
      );
    } catch (err: any) {
      console.error(`Push notification failed for ${participantId}:`, err.message);
      if (err.statusCode === 410) {
        await this.prisma.participant.update({
          where: { id: participantId },
          data: { pushSubscription: null },
        });
      }
    }
  }
}