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

// ✅ Erreur custom pour distinguer le rate limit
class RateLimitError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'RateLimitError';
  }
}

@Injectable()
export class DiscoveryService {
  private readonly openrouterApiKey: string;
  private readonly openrouterModel: string;
  private readonly openrouterUrl = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notifications: NotificationsService,
  ) {
    this.openrouterApiKey = this.config.get<string>('OPENROUTER_API_KEY') ?? '';
    this.openrouterModel =
      this.config.get<string>('OPENROUTER_MODEL') ??
      'meta-llama/llama-3.3-70b-instruct:free';

    console.log('OpenRouter key present:', !!this.openrouterApiKey);
    console.log('OpenRouter model:', this.openrouterModel);
  }

  // ─────────────────────────────────────────────
  // HELPER OpenRouter — abandon immédiat sur 429
  // ─────────────────────────────────────────────

  private async callAI(
    systemPrompt: string,
    userPrompt: string,
    options: { maxTokens?: number; temperature?: number; retries?: number } = {},
  ): Promise<string> {
    const { maxTokens = 200, temperature = 0.7, retries = 2 } = options;

    if (!this.openrouterApiKey) throw new Error('OPENROUTER_API_KEY non configurée');

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(this.openrouterUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.openrouterApiKey}`,
            'HTTP-Referer': this.config.get('FRONTEND_URL') ?? 'http://localhost:3000',
            'X-Title': 'MA_FO Matchmaking App',
          },
          body: JSON.stringify({
            model: this.openrouterModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: maxTokens,
            temperature,
          }),
        });

        // ✅ Abandon immédiat sur rate limit — pas de retry
        if (response.status === 429) {
          throw new RateLimitError('OpenRouter rate limit atteint');
        }

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenRouter error ${response.status}: ${error}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content ?? '';

      } catch (err: any) {
        // Ne jamais retry sur RateLimitError
        if (err instanceof RateLimitError) throw err;
        if (attempt === retries - 1) throw err;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    return '';
  }

  // ─────────────────────────────────────────────
  // FALLBACK — extraction de critères sans IA
  // ─────────────────────────────────────────────

  private extractCriteriaFallback(prompt: string): {
    sectors: string[];
    countries: string[];
    tags: string[];
    keywords: string[];
  } {
    const lower = prompt.toLowerCase();

    const sectorMap: Record<string, string[]> = {
      FinTech:     ['fintech', 'finance', 'banque', 'banking', 'paiement', 'payment'],
      ClimateTech: ['climat', 'climate', 'environnement', 'green', 'énergie', 'energie', 'renouvelable'],
      HealthTech:  ['santé', 'sante', 'health', 'médical', 'medical', 'pharma'],
      EdTech:      ['éducation', 'education', 'formation', 'edtech', 'apprentissage'],
      AgriTech:    ['agriculture', 'agri', 'agritech', 'farming'],
      Immobilier:  ['immobilier', 'real estate', 'construction'],
      Retail:      ['retail', 'commerce', 'distribution', 'e-commerce'],
      Industrie:   ['industrie', 'manufacturing', 'production'],
      Tourisme:    ['tourisme', 'tourism', 'hôtellerie', 'hotellerie', 'voyage'],
      Média:       ['média', 'media', 'presse', 'communication'],
      Tech:        ['startup', 'saas', 'logiciel', 'software', 'tech', 'digital', 'numérique'],
    };

    const countryMap: Record<string, string[]> = {
      TN: ['tunisie', 'tunisian', 'tunis', 'sfax', 'sousse', 'tunisiens', 'tunisien'],
      FR: ['france', 'français', 'francais', 'paris', 'lyon', 'marseille'],
      MA: ['maroc', 'moroccan', 'casablanca', 'rabat', 'marocain'],
      DZ: ['algérie', 'algerie', 'algerian', 'alger', 'algérien'],
      AE: ['dubai', 'émirats', 'emirats', 'uae', 'abu dhabi'],
      SN: ['sénégal', 'senegal', 'dakar'],
      CI: ["côte d'ivoire", "cote d'ivoire", 'abidjan', 'ivoirien'],
      US: ['etats-unis', 'états-unis', 'usa', 'américain', 'americain'],
    };

    const sectors: string[] = [];
    const countries: string[] = [];

    for (const [sector, keywords] of Object.entries(sectorMap)) {
      if (keywords.some((kw) => lower.includes(kw))) sectors.push(sector);
    }
    for (const [country, keywords] of Object.entries(countryMap)) {
      if (keywords.some((kw) => lower.includes(kw))) countries.push(country);
    }

    const stopWords = [
      'les', 'des', 'pour', 'avec', 'dans', 'qui', 'cherche', 'trouve',
      'en', 'et', 'ou', 'de', 'la', 'le', 'un', 'une', 'je', 'me', 'mon',
      'son', 'sur', 'par', 'que', 'est', 'sont', 'ont', 'une',
    ];
    const keywords = lower
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.includes(w))
      .slice(0, 3);

    return { sectors, countries, tags: [], keywords };
  }

  // ─────────────────────────────────────────────
  // FALLBACK — explication locale sans IA
  // ─────────────────────────────────────────────

  private generateFallbackExplanation(
    viewer: { jobTitle?: string; sector?: string; tags?: string } | null,
    profile: any,
    commonTags: string[],
  ): string {
    const sameSector =
      viewer?.sector &&
      profile.sector &&
      viewer.sector.toLowerCase() === profile.sector.toLowerCase();

    if (commonTags.length >= 2) {
      return (
        `Vous partagez des intérêts communs en ${commonTags.slice(0, 2).join(' et ')}. ` +
        `Un échange avec ${profile.firstName} pourrait ouvrir de nouvelles opportunités de collaboration.`
      );
    }
    if (sameSector) {
      return (
        `${profile.firstName} évolue dans le même secteur (${profile.sector}) — ` +
        `une connexion pertinente pour élargir votre réseau professionnel.`
      );
    }
    if (commonTags.length === 1) {
      return (
        `${profile.firstName} partage votre intérêt pour ${commonTags[0]}. ` +
        `Ce profil mérite votre attention pour développer des synergies.`
      );
    }
    if (profile.company) {
      return (
        `${profile.firstName} occupe le poste de ${profile.jobTitle ?? 'professionnel'} ` +
        `chez ${profile.company}. Ce profil pourrait enrichir votre réseau.`
      );
    }
    return (
      `${profile.firstName} est ${profile.jobTitle ?? 'un professionnel'} ` +
      `dont l'expertise pourrait compléter votre activité.`
    );
  }

  // ─────────────────────────────────────────────
  // 3.1 SWIPE MODE
  // ─────────────────────────────────────────────

  async getCurrentBatch(participantId: string) {
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

  async recordSwipe(
    participantId: string,
    dto: { targetParticipantId: string; action: SwipeAction; batchId: string },
  ) {
    const batch = await this.prisma.swipeBatch.findFirst({
      where: { id: dto.batchId, participantId, isComplete: false },
    });
    if (!batch) throw new BadRequestException('Batch introuvable ou déjà terminé');

    const target = await this.prisma.participant.findUnique({
      where: { id: dto.targetParticipantId },
    });
    if (!target) throw new NotFoundException('Profil introuvable');

    const existing = await this.prisma.swipe.findUnique({
      where: {
        senderId_receiverId: {
          senderId: participantId,
          receiverId: dto.targetParticipantId,
        },
      },
    });
    if (existing) throw new ConflictException('Vous avez déjà swipé ce profil');

    await this.prisma.swipe.create({
      data: {
        batchId: dto.batchId,
        senderId: participantId,
        receiverId: dto.targetParticipantId,
        action: dto.action,
      },
    });

    const newSwipedCount = batch.swipedCount + 1;
    const isComplete = newSwipedCount >= batch.totalCount;

    await this.prisma.swipeBatch.update({
      where: { id: batch.id },
      data: { swipedCount: newSwipedCount, isComplete },
    });

    let matchResult = null;
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

  private async checkMutualMatch(participantAId: string, participantBId: string) {
    const reverseSwipe = await this.prisma.swipe.findUnique({
      where: {
        senderId_receiverId: { senderId: participantBId, receiverId: participantAId },
      },
    });
    if (!reverseSwipe || reverseSwipe.action !== SwipeAction.RIGHT) return null;

    const existingConnection = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { participantAId, participantBId },
          { participantAId: participantBId, participantBId: participantAId },
        ],
      },
    });
    if (existingConnection) return null;

    const [participantA, participantB] = await Promise.all([
      this.prisma.participant.findUnique({ where: { id: participantAId } }),
      this.prisma.participant.findUnique({ where: { id: participantBId } }),
    ]);

    const connection = await this.prisma.connection.create({
      data: {
        participantAId,
        participantBId,
        type: ConnectionType.MATCHED,
        status: ConnectionStatus.ACCEPTED,
        initiatedBy: participantAId,
      },
    });

    await Promise.all([
      this.notifications.createInAppNotification({
        participantId: participantAId,
        type: 'MUTUAL_MATCH',
        title: 'Nouveau match ! 🎉',
        body: `Vous avez matché avec ${participantB.firstName} ${participantB.lastName} !`,
        deepLink: '/connections',
        metadata: JSON.stringify({
          connectionId: connection.id,
          matchedParticipantId: participantBId,
        }),
      }),
      this.notifications.createInAppNotification({
        participantId: participantBId,
        type: 'MUTUAL_MATCH',
        title: 'Nouveau match ! 🎉',
        body: `Vous avez matché avec ${participantA.firstName} ${participantA.lastName} !`,
        deepLink: '/connections',
        metadata: JSON.stringify({
          connectionId: connection.id,
          matchedParticipantId: participantAId,
        }),
      }),
      this.notifications.sendPushNotification(participantAId, {
        title: 'Nouveau match !',
        body: `Vous avez matché avec ${participantB.firstName} !`,
      }),
      this.notifications.sendPushNotification(participantBId, {
        title: 'Nouveau match !',
        body: `Vous avez matché avec ${participantA.firstName} !`,
      }),
    ]);

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
    const {
      page = 1, limit = 20, search, sector, country,
      profileType, role, tags, showConnected, aiPrompt,
    } = filters;

    if (aiPrompt) return this.aiSmartFilter(participantId, aiPrompt, page, limit);

    const skip = (page - 1) * limit;

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

    const excludeIds: string[] = [participantId];
    if (showConnected === 'false') excludeIds.push(...connectedIds);

    const where: any = {
      id: { notIn: excludeIds },
      isActive: true,
      isProfilePublic: true,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (sector) where.sector = { contains: sector, mode: 'insensitive' };
    if (country) where.country = country;
    if (profileType) where.profileType = profileType;
    if (role) where.jobTitle = { contains: role, mode: 'insensitive' };
    if (tags) {
      try {
        const tagList: string[] = JSON.parse(tags);
        if (tagList.length > 0) where.tags = { contains: tagList[0] };
      } catch { /* ignore */ }
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
        connectionStatus: isConnected
          ? 'CONNECTED'
          : hasPendingRequest
          ? 'REQUEST_SENT'
          : 'NOT_CONNECTED',
      };
    });

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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

    // ✅ Explication IA pour la vue détail avec fallback
    let aiCompatibility: string | null = null;
    const viewer = await this.prisma.participant.findUnique({
      where: { id: viewerId },
      select: { jobTitle: true, sector: true, tags: true },
    });

    if (this.openrouterApiKey) {
      try {
        aiCompatibility = await this.callAI(
          'Tu es un moteur de matchmaking B2B. Génère une explication courte (2-3 phrases) ' +
          'en français expliquant pourquoi ce profil est pertinent. Sois concis et professionnel.',
          `Participant: ${viewer?.jobTitle ?? 'N/A'} - Secteur: ${viewer?.sector ?? 'N/A'} - Tags: ${viewer?.tags ?? '[]'}
Profil consulté: ${participant.jobTitle} chez ${participant.company} - Secteur: ${participant.sector}`,
          { maxTokens: 150, temperature: 0.7, retries: 1 },
        );
      } catch {
        // Fallback silencieux
        const viewerTags: string[] = (() => {
          try { return JSON.parse(viewer?.tags ?? '[]'); }
          catch { return []; }
        })();
        const profileTags: string[] = (() => {
          try { return JSON.parse(participant.tags ?? '[]'); }
          catch { return []; }
        })();
        const commonTags = viewerTags.filter((t) => profileTags.includes(t));
        aiCompatibility = this.generateFallbackExplanation(viewer, participant, commonTags);
      }
    } else {
      const viewerTags: string[] = (() => {
        try { return JSON.parse(viewer?.tags ?? '[]'); }
        catch { return []; }
      })();
      const profileTags: string[] = (() => {
        try { return JSON.parse(participant.tags ?? '[]'); }
        catch { return []; }
      })();
      const commonTags = viewerTags.filter((t) => profileTags.includes(t));
      aiCompatibility = this.generateFallbackExplanation(viewer, participant, commonTags);
    }

    return {
      ...participant,
      connectionStatus: connection?.status ?? 'NOT_CONNECTED',
      connectionType: connection?.type ?? null,
      connectionId: connection?.id ?? null,
      aiCompatibility,
    };
  }

  // ─────────────────────────────────────────────
  // CONNECTION REQUESTS
  // ─────────────────────────────────────────────

  async sendConnectionRequest(senderId: string, targetParticipantId: string) {
    if (senderId === targetParticipantId)
      throw new BadRequestException('Vous ne pouvez pas vous connecter avec vous-même');

    const target = await this.prisma.participant.findUnique({
      where: { id: targetParticipantId },
    });
    if (!target) throw new NotFoundException('Participant introuvable');

    const existing = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { participantAId: senderId, participantBId: targetParticipantId },
          { participantAId: targetParticipantId, participantBId: senderId },
        ],
      },
    });
    if (existing?.status === ConnectionStatus.ACCEPTED)
      throw new ConflictException('Vous êtes déjà connectés');
    if (existing?.status === ConnectionStatus.PENDING)
      throw new ConflictException('Demande déjà envoyée');

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

    await Promise.all([
      this.notifications.createInAppNotification({
        participantId: targetParticipantId,
        type: 'CONNECTION_REQUEST_RECEIVED',
        title: 'Nouvelle demande de connexion',
        body: `${sender.firstName} ${sender.lastName} souhaite se connecter avec vous`,
        deepLink: `/discovery/profile/${senderId}`,
        metadata: JSON.stringify({ connectionId: connection.id, senderId }),
      }),
      this.notifications.sendPushNotification(targetParticipantId, {
        title: 'Nouvelle demande de connexion',
        body: `${sender.firstName} ${sender.lastName} souhaite se connecter`,
      }),
    ]);

    return { message: 'Demande de connexion envoyée', connectionId: connection.id };
  }

  async respondToConnectionRequest(
    participantId: string,
    connectionId: string,
    action: 'ACCEPTED' | 'REJECTED',
  ) {
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId },
    });
    if (!connection) throw new NotFoundException('Demande de connexion introuvable');
    if (connection.participantBId !== participantId)
      throw new BadRequestException("Vous n'êtes pas autorisé à répondre à cette demande");
    if (connection.status !== ConnectionStatus.PENDING)
      throw new BadRequestException('Cette demande a déjà été traitée');

    const updated = await this.prisma.connection.update({
      where: { id: connectionId },
      data: { status: action as ConnectionStatus },
    });

    const responder = await this.prisma.participant.findUnique({
      where: { id: participantId },
    });

    if (action === 'ACCEPTED') {
      await Promise.all([
        this.notifications.createInAppNotification({
          participantId: connection.participantAId,
          type: 'CONNECTION_REQUEST_ACCEPTED',
          title: 'Demande acceptée !',
          body: `${responder.firstName} ${responder.lastName} a accepté votre demande`,
          deepLink: '/connections',
          metadata: JSON.stringify({ connectionId }),
        }),
        this.notifications.sendPushNotification(connection.participantAId, {
          title: 'Connexion acceptée !',
          body: `${responder.firstName} a accepté votre demande`,
        }),
      ]);
    } else {
      await this.notifications.createInAppNotification({
        participantId: connection.participantAId,
        type: 'CONNECTION_REQUEST_ACCEPTED',
        title: 'Demande refusée',
        body: `${responder.firstName} a refusé votre demande de connexion`,
        deepLink: '/connections',
      });
    }

    return {
      message: action === 'ACCEPTED' ? 'Connexion acceptée' : 'Demande refusée',
      connection: updated,
    };
  }

  // ─────────────────────────────────────────────
  // AI SMART FILTER — avec fallback sans IA
  // ─────────────────────────────────────────────

  private async aiSmartFilter(
    participantId: string,
    prompt: string,
    page: number,
    limit: number,
  ) {
    let criteria: {
      sectors?: string[];
      countries?: string[];
      tags?: string[];
      keywords?: string[];
    } = {};
    let usedFallback = false;

    try {
      const raw = await this.callAI(
        'Tu es un moteur de recherche B2B. Extrait les critères de filtrage. ' +
        'Réponds UNIQUEMENT en JSON valide sans markdown ni backticks ni explication: ' +
        '{"sectors":[],"countries":[],"tags":[],"keywords":[]}',
        prompt,
        { maxTokens: 150, temperature: 0, retries: 1 },
      );
      const cleaned = raw.replace(/```json|```/g, '').trim();
      criteria = JSON.parse(cleaned);
    } catch (err: any) {
      // ✅ Fallback immédiat — extraction par dictionnaire
      console.warn('AI filter indisponible, fallback keyword search:', err.message);
      criteria = this.extractCriteriaFallback(prompt);
      usedFallback = true;
    }

    const excludeIds: string[] = [participantId];
    const where: any = {
      id: { notIn: excludeIds },
      isActive: true,
      isProfilePublic: true,
    };

    if (criteria.countries?.length) where.country = { in: criteria.countries };
    if (criteria.sectors?.length) where.sector = { in: criteria.sectors };

    // ✅ Fallback OR search sur keywords si aucun critère structuré
    if (
      !criteria.sectors?.length &&
      !criteria.countries?.length &&
      criteria.keywords?.length
    ) {
      const kw = criteria.keywords[0];
      where.OR = [
        { firstName: { contains: kw, mode: 'insensitive' } },
        { lastName: { contains: kw, mode: 'insensitive' } },
        { company: { contains: kw, mode: 'insensitive' } },
        { jobTitle: { contains: kw, mode: 'insensitive' } },
        { sector: { contains: kw, mode: 'insensitive' } },
      ];
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
      usedFallback,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─────────────────────────────────────────────
  // BATCH ASSEMBLY
  // ─────────────────────────────────────────────

  private async assembleBatch(participantId: string) {
    const BATCH_SIZE = 10;

    const [swiped, connections] = await Promise.all([
      this.prisma.swipe.findMany({
        where: { senderId: participantId },
        select: { receiverId: true },
      }),
      this.prisma.connection.findMany({
        where: {
          OR: [{ participantAId: participantId }, { participantBId: participantId }],
        },
        select: { participantAId: true, participantBId: true },
      }),
    ]);

    const swipedIds = swiped.map((s) => s.receiverId);
    const connectedIds = connections.map((c) =>
      c.participantAId === participantId ? c.participantBId : c.participantAId,
    );
    const excludeIds = [...new Set([...swipedIds, ...connectedIds, participantId])];

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
        data: { participantId, profileIds: '[]', totalCount: 0, isComplete: true },
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

    await Promise.all([
      this.notifications.createInAppNotification({
        participantId,
        type: 'NEW_SWIPE_BATCH',
        title: 'Nouveau batch disponible !',
        body: `${profileIds.length} nouveaux profils vous attendent`,
        deepLink: '/discovery/swipe',
      }),
      this.notifications.sendPushNotification(participantId, {
        title: 'Nouveaux matches prêts 🎯',
        body: `${profileIds.length} profils sélectionnés pour vous`,
      }),
    ]);

    return batch;
  }

  // ─────────────────────────────────────────────
  // AI EXPLANATION — max 3 appels IA + fallback
  // ─────────────────────────────────────────────

  private async enrichWithAiExplanation(participantId: string, profiles: any[]) {
    const viewer = await this.prisma.participant.findUnique({
      where: { id: participantId },
      select: { sector: true, tags: true, jobTitle: true },
    });

    const viewerTags: string[] = (() => {
      try { return JSON.parse(viewer?.tags ?? '[]'); }
      catch { return []; }
    })();

    const results: any[] = [];
    let rateLimitHit = false;
    // ✅ Max 3 appels IA par batch — reste sous le quota gratuit OpenRouter
    const AI_CALLS_MAX = 3;
    let aiCallCount = 0;

    for (const profile of profiles) {
      const profileTags: string[] = (() => {
        try { return JSON.parse(profile.tags ?? '[]'); }
        catch { return []; }
      })();

      const commonTags = viewerTags.filter((t) => profileTags.includes(t));
      const matchScore = Math.min(
        parseFloat((0.55 + commonTags.length * 0.08).toFixed(2)),
        0.99,
      );

      const useAI =
        this.openrouterApiKey && !rateLimitHit && aiCallCount < AI_CALLS_MAX;

      if (!useAI) {
        results.push({
          ...profile,
          aiExplanation: this.generateFallbackExplanation(viewer, profile, commonTags),
          matchScore,
        });
        continue;
      }

      try {
        const aiExplanation = await this.callAI(
          'Tu es un moteur de matchmaking B2B. Génère une explication courte (2 phrases maximum) ' +
          'en français expliquant pourquoi ce profil est pertinent pour le participant. ' +
          'Sois concis, professionnel et valorisant. Ne commence pas par "Ce profil".',
          `Participant: ${viewer?.jobTitle ?? 'N/A'} - Secteur: ${viewer?.sector ?? 'N/A'} - Tags: ${viewer?.tags ?? '[]'}
Profil suggéré: ${profile.jobTitle ?? 'N/A'} chez ${profile.company ?? 'N/A'} - Secteur: ${profile.sector ?? 'N/A'}`,
          { maxTokens: 100, temperature: 0.75, retries: 1 },
        );
        aiCallCount++;
        results.push({ ...profile, aiExplanation: aiExplanation.trim(), matchScore });

      } catch (err: any) {
        if (err instanceof RateLimitError) {
          rateLimitHit = true;
          console.warn('Rate limit atteint — fallback texte pour les profils restants');
        }
        results.push({
          ...profile,
          aiExplanation: this.generateFallbackExplanation(viewer, profile, commonTags),
          matchScore,
        });
      }
    }

    return results;
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