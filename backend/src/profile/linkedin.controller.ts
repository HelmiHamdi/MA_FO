// src/profile/linkedin.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { LinkedInService } from './linkedin.service';

@ApiTags('LinkedIn OAuth')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile/linkedin')
export class LinkedInController {
  constructor(private linkedinService: LinkedInService) {}

  /**
   * GET /profile/linkedin/oauth/init
   * Génère l'URL OAuth LinkedIn + state CSRF
   */
  @Get('oauth/init')
  @ApiOperation({ summary: 'Initialiser OAuth LinkedIn — retourne authUrl + state' })
  async initOAuth(@GetUser('id') participantId: string) {
    return this.linkedinService.generateAuthUrl(participantId);
  }

  /**
   * POST /profile/linkedin/oauth/callback
   * Échange le code contre les tokens, importe le profil
   */
  @Post('oauth/callback')
  @ApiOperation({ summary: 'Callback OAuth LinkedIn — échange code → tokens → import profil' })
  async handleCallback(
    @GetUser('id') participantId: string,
    @Body('code') code: string,
    @Body('state') state: string,
  ) {
    if (!code || !state) {
      throw new BadRequestException('code et state sont requis');
    }
    return this.linkedinService.handleCallback(participantId, code, state);
  }

  /**
   * POST /profile/linkedin/disconnect
   * Révoque et supprime le token LinkedIn
   */
  @Post('disconnect')
  @ApiOperation({ summary: 'Déconnecter LinkedIn' })
  async disconnect(@GetUser('id') participantId: string) {
    return this.linkedinService.disconnect(participantId);
  }
}