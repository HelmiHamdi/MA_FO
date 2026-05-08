// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import {
  RequestEmailOtpDto,
  RequestPhoneOtpDto,
  VerifyOtpDto,
  QrLoginDto,
  RefreshTokenDto,
} from './dto';
import { Public } from './decorators/public.decorator';
import { GetUser } from './decorators/get-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth Module')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  // ─── Method A: Email OTP ─────────────────────

  @Public()
  @Post('otp/email/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: '1.1 Demander un OTP par email' })
  @ApiResponse({ status: 200, description: 'OTP envoyé par email' })
  @ApiResponse({ status: 404, description: 'Email non trouvé dans la plateforme' })
  requestEmailOtp(@Body() dto: RequestEmailOtpDto) {
    return this.authService.requestEmailOtp(dto.email);
  }

  // ─── Method B: Phone OTP ─────────────────────

  @Public()
  @Post('otp/phone/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: '1.1 Demander un OTP par SMS' })
  @ApiResponse({ status: 200, description: 'OTP envoyé par SMS' })
  @ApiResponse({ status: 404, description: 'Numéro de téléphone non trouvé' })
  requestPhoneOtp(@Body() dto: RequestPhoneOtpDto) {
    return this.authService.requestPhoneOtp(dto.phone);
  }

  // ─── OTP Verification (shared screen 1.2) ────

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: '1.2 Vérifier le code OTP (email ou phone)' })
  @ApiResponse({ status: 200, description: 'Authentification réussie — JWT émis' })
  @ApiResponse({ status: 401, description: 'Code incorrect' })
  @ApiResponse({ status: 403, description: 'Trop de tentatives — compte bloqué' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  // ─── DEBUG ONLY — Désactivé en production ────

  @Public()
  @Get('debug/qr/:participantId')
  @ApiOperation({
    summary: '[DEBUG] Générer ET sauvegarder un qrToken pour tests Postman',
  })
  async debugGenerateQr(@Param('participantId') participantId: string) {
    // FIX: refuser en production
    if (this.config.get('NODE_ENV') === 'production') {
      throw new ForbiddenException('Route non disponible en production');
    }
    const qrToken = await this.authService.generateAndSaveQrToken(participantId);
    return { participantId, qrToken };
  }

  // ─── Method C: QR Code Scan ──────────────────

  @Public()
  @Post('qr/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '1.1 Connexion par QR code badge (scan)' })
  @ApiResponse({ status: 200, description: 'Connexion QR réussie — JWT émis' })
  @ApiResponse({ status: 401, description: 'QR invalide ou déjà utilisé' })
  loginWithQr(@Body() dto: QrLoginDto) {
    return this.authService.loginWithQr(dto.qrToken);
  }

  // ─── Refresh Token ────────────────────────────

  @Public()
  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rafraîchir le access token' })
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  // ─── Logout ───────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Déconnexion — révocation du refresh token' })
  logout(
    @GetUser('id') participantId: string,
    // FIX: type explicite au lieu de { refreshToken?: string }
    @Body() body: { refreshToken?: string },
  ) {
    return this.authService.logout(participantId, body.refreshToken);
  }
}