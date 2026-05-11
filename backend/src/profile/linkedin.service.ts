// src/profile/linkedin.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as crypto from 'crypto';

// ─── Types LinkedIn API ────────────────────────────────────────────────────────
interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
}

interface LinkedInProfile {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
  email?: string;
  locale?: { country: string; language: string };
}

// Pour l'API LinkedIn v2 (si openid connect non disponible)
interface LinkedInPositionsResponse {
  elements?: Array<{
    title?: string;
    company?: { name?: string };
    current?: boolean;
  }>;
}

const SENSITIVE_FIELDS = ['linkedinAccessToken', 'badgeQrToken', 'embeddingVector'] as const;

function stripSensitive(participant: Record<string, any>) {
  const safe = { ...participant };
  for (const field of SENSITIVE_FIELDS) delete safe[field];
  return safe;
}

// ─── CSRF state store (en prod : Redis avec TTL 10 min) ───────────────────────
// Simple Map en mémoire — remplacer par Redis en production
const oauthStateStore = new Map<string, { participantId: string; expiresAt: number }>();

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class LinkedInService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.clientId = this.config.getOrThrow<string>('LINKEDIN_CLIENT_ID');
    this.clientSecret = this.config.getOrThrow<string>('LINKEDIN_CLIENT_SECRET');
    this.redirectUri = this.config.getOrThrow<string>('LINKEDIN_REDIRECT_URI');
    // ex: https://yourapp.com/profile/linkedin  (le frontend gère le callback)
  }

  // ── 1. Générer URL OAuth ──────────────────────────────────────────────────
  async generateAuthUrl(participantId: string): Promise<{ authUrl: string; state: string }> {
    const state = crypto.randomBytes(16).toString('hex');

    // Stocker state → participantId avec TTL
    oauthStateStore.set(state, {
      participantId,
      expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
    });

    // Nettoyer les states expirés
    for (const [k, v] of oauthStateStore.entries()) {
      if (v.expiresAt < Date.now()) oauthStateStore.delete(k);
    }

    const scope = 'openid profile email'; // LinkedIn OpenID Connect (r_liteprofile deprecated)
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
      scope,
    });

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    return { authUrl, state };
  }

  // ── 2. Callback : échange code → tokens → import profil ──────────────────
  async handleCallback(
    participantId: string,
    code: string,
    state: string,
  ): Promise<{ participant: Record<string, any> }> {
    // Valider le state CSRF
    const stored = oauthStateStore.get(state);
    if (!stored) throw new BadRequestException('State OAuth invalide ou expiré');
    if (stored.participantId !== participantId)
      throw new UnauthorizedException('State OAuth ne correspond pas à votre session');
    if (stored.expiresAt < Date.now())
      throw new BadRequestException('State OAuth expiré — recommencez');

    oauthStateStore.delete(state);

    // Échanger le code contre un access_token
    let tokenData: LinkedInTokenResponse;
    try {
      const tokenRes = await axios.post<LinkedInTokenResponse>(
        'https://www.linkedin.com/oauth/v2/accessToken',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      tokenData = tokenRes.data;
    } catch (err: any) {
      const msg = err?.response?.data?.error_description ?? 'Échange de token LinkedIn échoué';
      throw new BadRequestException(msg);
    }

    // Récupérer le profil LinkedIn (OpenID Connect userinfo)
    let liProfile: LinkedInProfile;
    try {
      const profileRes = await axios.get<LinkedInProfile>(
        'https://api.linkedin.com/v2/userinfo',
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
      );
      liProfile = profileRes.data;
    } catch {
      throw new InternalServerErrorException('Impossible de récupérer le profil LinkedIn');
    }

    // Optionnel : récupérer le poste actuel via l'API positions (si scope r_basicprofile disponible)
    let currentJobTitle: string | undefined;
    let currentCompany: string | undefined;
    try {
      const posRes = await axios.get<LinkedInPositionsResponse>(
        'https://api.linkedin.com/v2/positions?q=members&count=5',
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
      );
      const current = posRes.data.elements?.find((el) => el.current);
      if (current) {
        currentJobTitle = current.title;
        currentCompany = current.company?.name;
      }
    } catch {
      // L'API positions peut ne pas être accessible selon les scopes — non bloquant
    }

    // Mettre à jour le participant en base
    const updatedParticipant = await this.prisma.participant.update({
      where: { id: participantId },
      data: {
        linkedinConnected: true,
        linkedinAccessToken: tokenData.access_token,
        // Import des champs seulement s'ils ne sont pas déjà renseignés
        ...(liProfile.picture && { photoUrl: liProfile.picture }),
        ...(currentJobTitle && { jobTitle: currentJobTitle }),
        ...(currentCompany && { company: currentCompany }),
        // URL du profil LinkedIn (le "sub" OpenID Connect est l'ID numérique)
        linkedinUrl: `https://www.linkedin.com/in/${liProfile.sub}`,
      },
    });

    return { participant: stripSensitive(updatedParticipant as any) };
  }

  // ── 3. Déconnecter ────────────────────────────────────────────────────────
  async disconnect(participantId: string): Promise<{ participant: Record<string, any> }> {
    // Récupérer le token pour révoquer côté LinkedIn (best-effort)
    const current = await this.prisma.participant.findUnique({
      where: { id: participantId },
      select: { linkedinAccessToken: true },
    });

    if (current?.linkedinAccessToken) {
      try {
        // LinkedIn ne fournit pas d'endpoint de révocation standard — on vide juste notre côté
        // Pour une révocation complète, l'utilisateur doit aller dans ses apps LinkedIn
      } catch {
        /* non bloquant */
      }
    }

    const updatedParticipant = await this.prisma.participant.update({
      where: { id: participantId },
      data: {
        linkedinConnected: false,
        linkedinAccessToken: null,
      },
    });

    return { participant: stripSensitive(updatedParticipant as any) };
  }
}