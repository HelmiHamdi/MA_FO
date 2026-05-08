// src/discovery/discovery.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { SwipeAction, ConnectionStatus, ConnectionType } from '@prisma/client';
import { ViewAllFilterDto } from './dto';
import OpenAI from 'openai';

@Injectable()
export class DiscoveryService {
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notifications: NotificationsService,
  ) {
    this.openai = new OpenAI({ apiKey: config.get('OPENAI_API_KEY') });
  }

  // ─────────────────────────────────────────────
  // 3.1 SWIPE MODE
  // ─────────────────────────────────────────────

  /**
   * Récupère le batch actif ou en crée un nouveau si aucun n'est en cours.
   */
  async getCurrentBatch(participantId: string) {
    // Find active incomplete batch
    let batch = await this.prisma.swipeBatch.findFirst({
      where: { participantId, isComplete: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!batch) {
      batch = await this.assembleBatch(participantId);
    }

    const profileIds: string[] = JSON.parse(batch.profileIds || '[]');
    const swipedIds = await this.prisma.swipe
      .findMany({ where: { batchId: batch.id }, select: { receiverId: true } })
      .then((s) => s.map((x) => x.receiverId));

    const remainingIds = profileIds.filter((id) => !swipedIds.includes(id));

    const profiles = await this.prisma.participant.findMany({
      where: { id: { in: remainingIds } },
      select: this.publicProfileSelect(),
    });

    // Generate AI explanations for remaining profiles
    const profilesWithAI = await this.enrichWithAiExplanation(participantId, profiles);

    return {
      batchId: batch.id,
      totalCount: batch.totalCount,
      remaining: remainingIds.length,
      swiped: swipedIds.length,
      isComplete: batch.isComplete,
      profiles: profilesWithAI,
    };
  }

  /**
   * Enregistre un swipe (RIGHT ou LEFT) et vérifie le match mutuel.
   */
  async recordSwipe(participantId: string, dto: { targetParticipantId: string; action: SwipeAction; batchId: string }) {
    const batch = await this.prisma.swipeBatch.findFirst({
      where: { id: dto.batchId, participantId, isComplete: false },
    });

    if (!batch) {
      throw new BadRequestException('Batch introuvable ou déjà terminé');
    }

    const target = await this.prisma.participant.findUnique({
      where: { id: dto.targetParticipantId },
    });
    if (!target) throw new NotFoundException('Profil introuvable');

    // Check if already swiped
    const existing = await this.prisma.swipe.findUnique({
      where: { senderId_receiverId: { senderId: participantId, receiverId: dto.targetParticipantId } },
    });
    if (existing) throw new ConflictException('Vous avez déjà swipé ce profil');

    // Create swipe record
    const swipe = await this.prisma.swipe.create({
      data: {
        batchId: dto.batchId,
        senderId: participantId,
        receiverId: dto.targetParticipantId,
        action: dto.action,
      },
    });

    // Update batch progress
    const newSwipedCount = batch.swipedCount + 1;
    const isComplete = newSwipedCount >= batch.totalCount;

    await this.prisma.swipeBatch.update({
      where: { id: batch.id },
      data: { swipedCount: newSwipedCount, isComplete },
    });

    let matchResult = null;

    // If RIGHT swipe, check for mutual match
    if (dto.action === SwipeAction.RIGHT) {
      matchResult = await this.checkMutualMatch(participantId, dto.targetParticipantId);
    }

    return {
      swipeRecorded: true,
      action: dto.action,
      batchProgress: { swiped: newSwipedCount, total: batch.totalCount, isComplete },
      match: matchResult,
    };
  }

  /**
   * Vérifie si l'autre participant a aussi swipé RIGHT → crée la connexion.
   */
  private async checkMutualMatch(participantAId: string, participantBId: string) {
    const reverseSwipe = await this.prisma.swipe.findUnique({
      where: {
        senderId_receiverId: { senderId: participantBId, receiverId: participantAId },
      },
    });

    if (!reverseSwipe || reverseSwipe.action !== SwipeAction.RIGHT) {
      return null;
    }

    // Check if connection already exists
    const existingConnection = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { participantAId, participantBId },
          { participantAId: participantBId, participantBId: participantAId },
        ],
      },
    });

    if (existingConnection) return null;

    // Create mutual connection
    const participantA = await this.prisma.participant.findUnique({ where: { id: participantAId } });
    const participantB = await this.prisma.participant.findUnique({ where: { id: participantBId } });

    const connection = await this.prisma.connection.create({
      data: {
        participantAId,
        participantBId,
        type: ConnectionType.MATCHED,
        status: ConnectionStatus.ACCEPTED,
        initiatedBy: participantAId,
      },
    });

    // Notify both participants
    await this.notifications.createInAppNotification({
      participantId: participantAId,
      type: 'MUTUAL_MATCH',
      title: 'Nouveau match ! 🎉',
      body: `Vous avez matché avec ${participantB.firstName} ${participantB.lastName} !`,
      deepLink: '/connections',
      metadata: JSON.stringify({ connectionId: connection.id, matchedParticipantId: participantBId }),
    });

    await this.notifications.createInAppNotification({
      participantId: participantBId,
      type: 'MUTUAL_MATCH',
      title: 'Nouveau match ! 🎉',
      body: `Vous avez matché avec ${participantA.firstName} ${participantA.lastName} !`,
      deepLink: '/connections',
      metadata: JSON.stringify({ connectionId: connection.id, matchedParticipantId: participantAId }),
    });

    await this.notifications.sendPushNotification(participantAId, {
      title: 'Nouveau match !',
      body: `Vous avez matché avec ${participantB.firstName} !`,
    });

    await this.notifications.sendPushNotification(participantBId, {
      title: 'Nouveau match !',
      body: `Vous avez matché avec ${participantA.firstName} !`,
    });

    return {
      isMatch: true,
      connectionId: connection.id,
      matchedWith: {
        id: participantBId,
        firstName: participantB.firstName,
        lastName: participantB.lastName,
      },
    };
  }

  // ─────────────────────────────────────────────
  // 3.2 VIEW ALL MODE
  // ─────────────────────────────────────────────

  async viewAll(participantId: string, filters: ViewAllFilterDto) {
    const { page = 1, limit = 20, search, sector, country, profileType, role, tags, showConnected, aiPrompt } = filters;

    // If AI prompt provided, use vector search
    if (aiPrompt) {
      return this.aiSmartFilter(participantId, aiPrompt, page, limit);
    }

    const skip = (page - 1) * limit;

    // Get connections to check status
    const connections = await this.prisma.connection.findMany({
      where: {
        OR: [{ participantAId: participantId }, { participantBId: participantId }],
        status: ConnectionStatus.ACCEPTED,
      },
      select: { participantAId: true, participantBId: true },
    });
    const connectedIds = connections.map((c) =>
      c.participantAId === participantId ? c.participantBId : c.participantAId,
    );

    // Base where clause
    const where: any = {
      id: { not: participantId },
      isActive: true,
      isProfilePublic: true,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { company: { contains: search } },
      ];
    }
    if (sector) where.sector = { contains: sector };
    if (country) where.country = country;
    if (profileType) where.profileType = profileType;
    if (role) where.jobTitle = { contains: role };
    if (showConnected === 'false') {
      where.id = { not: { in: [...connectedIds, participantId] } };
    }
    if (tags) {
      const tagList: string[] = JSON.parse(tags);
      // Simple contains check — in production use JSON_CONTAINS or similar
      where.tags = { contains: tagList[0] };
    }

    const [total, participants] = await Promise.all([
      this.prisma.participant.count({ where }),
      this.prisma.participant.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ visibilityScore: 'desc' }, { firstName: 'asc' }],
        select: this.publicProfileSelect(),
      }),
    ]);

    // Annotate connection status
    const pendingRequests = await this.prisma.connection.findMany({
      where: {
        OR: [{ participantAId: participantId }, { participantBId: participantId }],
        status: ConnectionStatus.PENDING,
      },
    });

    const data = participants.map((p) => {
      const isConnected = connectedIds.includes(p.id);
      const hasPendingRequest = pendingRequests.some(
        (r) =>
          (r.participantAId === participantId && r.participantBId === p.id) ||
          (r.participantBId === participantId && r.participantAId === p.id),
      );
      return {
        ...p,
        connectionStatus: isConnected ? 'CONNECTED' : hasPendingRequest ? 'REQUEST_SENT' : 'NOT_CONNECTED',
      };
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getParticipantProfile(viewerId: string, targetId: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { id: targetId },
      select: {
        ...this.publicProfileSelect(),
        bio: true,
        bioEn: true,
        linkedinUrl: true,
        websiteUrl: true,
        linkedinConnected: true,
        linkedinData: true,
        tags: true,
      },
    });

    if (!participant) throw new NotFoundException('Profil introuvable');

    const connection = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { participantAId: viewerId, participantBId: targetId },
          { participantAId: targetId, participantBId: viewerId },
        ],
      },
    });

    return {
      ...participant,
      connectionStatus: connection?.status ?? 'NOT_CONNECTED',
      connectionType: connection?.type ?? null,
      connectionId: connection?.id ?? null,
    };
  }

  // ─────────────────────────────────────────────
  // CONNECTION REQUESTS
  // ─────────────────────────────────────────────

  async sendConnectionRequest(senderId: string, targetParticipantId: string) {
    if (senderId === targetParticipantId) {
      throw new BadRequestException('Vous ne pouvez pas vous connecter avec vous-même');
    }

    const target = await this.prisma.participant.findUnique({ where: { id: targetParticipantId } });
    if (!target) throw new NotFoundException('Participant introuvable');

    const existing = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { participantAId: senderId, participantBId: targetParticipantId },
          { participantAId: targetParticipantId, participantBId: senderId },
        ],
      },
    });

    if (existing) {
      if (existing.status === ConnectionStatus.ACCEPTED) throw new ConflictException('Vous êtes déjà connectés');
      if (existing.status === ConnectionStatus.PENDING) throw new ConflictException('Demande déjà envoyée');
    }

    const sender = await this.prisma.participant.findUnique({ where: { id: senderId } });

    const connection = await this.prisma.connection.create({
      data: {
        participantAId: senderId,
        participantBId: targetParticipantId,
        type: ConnectionType.CONNECTED,
        status: ConnectionStatus.PENDING,
        initiatedBy: senderId,
      },
    });

    // Notify target
    await this.notifications.createInAppNotification({
      participantId: targetParticipantId,
      type: 'CONNECTION_REQUEST_RECEIVED',
      title: 'Nouvelle demande de connexion',
      body: `${sender.firstName} ${sender.lastName} souhaite se connecter avec vous`,
      deepLink: `/discovery/profile/${senderId}`,
      metadata: JSON.stringify({ connectionId: connection.id, senderId }),
    });

    await this.notifications.sendPushNotification(targetParticipantId, {
      title: 'Nouvelle demande de connexion',
      body: `${sender.firstName} ${sender.lastName} souhaite se connecter`,
    });

    return { message: 'Demande de connexion envoyée', connectionId: connection.id };
  }

  async respondToConnectionRequest(participantId: string, connectionId: string, action: 'ACCEPTED' | 'REJECTED') {
    const connection = await this.prisma.connection.findUnique({ where: { id: connectionId } });

    if (!connection) throw new NotFoundException('Demande de connexion introuvable');
    if (connection.participantBId !== participantId) {
      throw new BadRequestException("Vous n'êtes pas autorisé à répondre à cette demande");
    }
    if (connection.status !== ConnectionStatus.PENDING) {
      throw new BadRequestException('Cette demande a déjà été traitée');
    }

    const updated = await this.prisma.connection.update({
      where: { id: connectionId },
      data: { status: action as ConnectionStatus },
    });

    const responder = await this.prisma.participant.findUnique({ where: { id: participantId } });

    if (action === 'ACCEPTED') {
      await this.notifications.createInAppNotification({
        participantId: connection.participantAId,
        type: 'CONNECTION_REQUEST_ACCEPTED',
        title: 'Demande acceptée !',
        body: `${responder.firstName} ${responder.lastName} a accepté votre demande de connexion`,
        deepLink: '/connections',
        metadata: JSON.stringify({ connectionId }),
      });

      await this.notifications.sendPushNotification(connection.participantAId, {
        title: 'Connexion acceptée !',
        body: `${responder.firstName} a accepté votre demande`,
      });
    } else {
      await this.notifications.createInAppNotification({
        participantId: connection.participantAId,
        type: 'CONNECTION_REQUEST_ACCEPTED',
        title: 'Demande refusée',
        body: `${responder.firstName} a refusé votre demande de connexion`,
        deepLink: '/connections',
      });
    }

    return { message: action === 'ACCEPTED' ? 'Connexion acceptée' : 'Demande refusée', connection: updated };
  }

  // ─────────────────────────────────────────────
  // AI SMART FILTER
  // ─────────────────────────────────────────────

  private async aiSmartFilter(participantId: string, prompt: string, page: number, limit: number) {
    // In production: use pgvector + OpenAI embeddings for semantic search
    // Here we do a simple GPT-powered keyword extraction + DB filter
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Tu es un moteur de recherche. Extrait les critères de filtrage de la requête utilisateur. Réponds UNIQUEMENT en JSON: {"sectors":[],"countries":[],"tags":[],"keywords":[]}',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0,
      });

      let criteria: any = {};
      try {
        criteria = JSON.parse(completion.choices[0].message.content);
      } catch {
        criteria = { keywords: [prompt] };
      }

      const where: any = {
        id: { not: participantId },
        isActive: true,
        isProfilePublic: true,
      };

      if (criteria.countries?.length) {
        where.country = { in: criteria.countries };
      }
      if (criteria.sectors?.length) {
        where.sector = { in: criteria.sectors };
      }

      const [total, participants] = await Promise.all([
        this.prisma.participant.count({ where }),
        this.prisma.participant.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { visibilityScore: 'desc' },
          select: this.publicProfileSelect(),
        }),
      ]);

      return {
        data: participants,
        aiPromptUsed: prompt,
        criteria,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (err) {
      console.error('AI smart filter error:', err);
      throw new BadRequestException('Erreur lors du filtrage IA. Veuillez réessayer.');
    }
  }

  // ─────────────────────────────────────────────
  // BATCH ASSEMBLY (AI-powered)
  // ─────────────────────────────────────────────

  private async assembleBatch(participantId: string): Promise<any> {
    const BATCH_SIZE = 10;

    // Get already swiped IDs to exclude
    const swiped = await this.prisma.swipe.findMany({
      where: { senderId: participantId },
      select: { receiverId: true },
    });
    const swipedIds = swiped.map((s) => s.receiverId);

    // Get connected IDs to exclude
    const connections = await this.prisma.connection.findMany({
      where: {
        OR: [{ participantAId: participantId }, { participantBId: participantId }],
      },
      select: { participantAId: true, participantBId: true },
    });
    const connectedIds = connections.map((c) =>
      c.participantAId === participantId ? c.participantBId : c.participantAId,
    );

    const excludeIds = [...new Set([...swipedIds, ...connectedIds, participantId])];

    // Fetch candidates ordered by visibility score (cosine similarity would be used in production with pgvector)
    const candidates = await this.prisma.participant.findMany({
      where: {
        id: { notIn: excludeIds },
        isActive: true,
        isProfilePublic: true,
      },
      orderBy: { visibilityScore: 'desc' },
      take: BATCH_SIZE,
      select: { id: true },
    });

    if (candidates.length === 0) {
      return this.prisma.swipeBatch.create({
        data: {
          participantId,
          profileIds: '[]',
          totalCount: 0,
          isComplete: true,
        },
      });
    }

    const profileIds = candidates.map((c) => c.id);

    const batch = await this.prisma.swipeBatch.create({
      data: {
        participantId,
        profileIds: JSON.stringify(profileIds),
        totalCount: profileIds.length,
        notifiedAt: new Date(),
      },
    });

    // Notify participant about new batch
    await this.notifications.createInAppNotification({
      participantId,
      type: 'NEW_SWIPE_BATCH',
      title: 'Nouveau batch disponible !',
      body: `${profileIds.length} nouveaux profils vous attendent`,
      deepLink: '/discovery/swipe',
    });

    await this.notifications.sendPushNotification(participantId, {
      title: 'Nouveaux matches prêts 🎯',
      body: `${profileIds.length} profils sélectionnés pour vous`,
    });

    return batch;
  }

  // ─────────────────────────────────────────────
  // AI EXPLANATION (GPT-4o)
  // ─────────────────────────────────────────────

  private async enrichWithAiExplanation(participantId: string, profiles: any[]) {
    const viewer = await this.prisma.participant.findUnique({
      where: { id: participantId },
      select: { sector: true, tags: true, jobTitle: true },
    });

    return Promise.all(
      profiles.map(async (profile) => {
        try {
          const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content:
                  'Tu es un moteur de matchmaking B2B. Génère une explication courte (2 phrases max) en français expliquant pourquoi ce profil est pertinent pour le participant. Sois concis et professionnel.',
              },
              {
                role: 'user',
                content: `Participant: ${viewer.jobTitle} - Secteur: ${viewer.sector} - Tags: ${viewer.tags}
Profil suggéré: ${profile.jobTitle} chez ${profile.company} - Secteur: ${profile.sector}`,
              },
            ],
            max_tokens: 100,
            temperature: 0.7,
          });
          return {
            ...profile,
            aiExplanation: completion.choices[0].message.content,
            matchScore: Math.random() * 0.3 + 0.7, // In production: real cosine similarity
          };
        } catch {
          return { ...profile, aiExplanation: null, matchScore: null };
        }
      }),
    );
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private publicProfileSelect() {
    return {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      company: true,
      sector: true,
      country: true,
      photoUrl: true,
      tags: true,
      profileType: true,
      visibilityScore: true,
      linkedinConnected: true,
    };
  }
}