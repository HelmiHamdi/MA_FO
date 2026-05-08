// src/notifications/notifications.controller.ts
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
import { NotificationsService } from './notifications.service';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class RegisterPushDto {
  @IsObject()
  subscription: object;
}

@ApiTags('Notifications Module')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: '7.2 Centre de notifications in-app — historique complet' })
  getNotifications(
    @GetUser('id') participantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    return this.notificationsService.getNotifications(
      participantId,
      parseInt(page ?? '1'),
      parseInt(limit ?? '20'),
      type,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Badge count — nombre de notifications non lues' })
  getUnreadCount(@GetUser('id') participantId: string) {
    return this.notificationsService.getUnreadCount(participantId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: '7.2 Marquer toutes les notifications comme lues' })
  markAllRead(@GetUser('id') participantId: string) {
    return this.notificationsService.markAsRead(participantId);
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: '7.2 Marquer une notification comme lue' })
  markOneRead(
    @GetUser('id') participantId: string,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(participantId, notificationId);
  }

  @Post('push/subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '7.1 Enregistrer l\'abonnement push (PWA service worker)' })
  registerPush(@GetUser('id') participantId: string, @Body() dto: RegisterPushDto) {
    return this.notificationsService.registerPushSubscription(participantId, dto.subscription);
  }
}