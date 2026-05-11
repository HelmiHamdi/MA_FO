// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { MeetingsModule } from './meetings/meetings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ProfileModule } from './profile/profile.module';
import { ConnectionsService } from './connections/connections.service';
import { ConnectionsModule } from './connections/connections.module';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { ChatModule } from './chat/chat.module';
import { TablesModule } from './tables/tables.module';

@Module({
  imports: [
    // Config — chargé en premier, disponible partout
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting global
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requêtes / minute par IP
      },
    ]),

    // Scheduler (pour reminders réunions, etc.)
    ScheduleModule.forRoot(),

    // Infrastructure
    PrismaModule,

    // Feature modules
    AuthModule,
    DiscoveryModule,
    MeetingsModule,
    NotificationsModule,
    ProfileModule,
    ConnectionsModule,
    ChatModule,
    TablesModule,
  ],
  providers: [
    // Guard JWT global — toutes les routes sont protégées sauf @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Rate limiter global
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Exception filter global
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    ConnectionsService,
    ChatService,
  ],
  controllers: [ChatController],
})
export class AppModule {}