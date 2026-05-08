// src/auth/auth.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OtpMethod, OtpStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import * as ms from 'ms';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  // ─────────────────────────────────────────────
  // METHOD A — EMAIL OTP
  // ─────────────────────────────────────────────

  async requestEmailOtp(email: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { email },
    });
    if (!participant) {
      throw new NotFoundException('Aucun participant trouvé avec cet email');
    }

    await this.checkAndInvalidatePreviousOtp(participant.id, OtpMethod.EMAIL);

    const code = this.generateOtpCode();
    const hashedCode = await bcrypt.hash(code, 10);
    const expiresAt = new Date(
      Date.now() +
        this.config.get<number>('OTP_EXPIRY_MINUTES', 10) * 60 * 1000,
    );

    await this.prisma.otpCode.create({
      data: {
        participantId: participant.id,
        code: hashedCode,
        method: OtpMethod.EMAIL,
        status: OtpStatus.PENDING,
        expiresAt,
      },
    });

    await this.sendEmailOtp(email, code, participant.firstName);

    return {
      message: `Code OTP envoyé à ${this.maskEmail(email)}`,
      destination: this.maskEmail(email),
      resendAfterSeconds: this.config.get<number>(
        'OTP_RESEND_COOLDOWN_SECONDS',
        60,
      ),
    };
  }

  // ─────────────────────────────────────────────
  // METHOD B — PHONE OTP
  // ─────────────────────────────────────────────

  async requestPhoneOtp(phone: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { phone },
    });
    if (!participant) {
      throw new NotFoundException(
        'Aucun participant trouvé avec ce numéro de téléphone',
      );
    }

    await this.checkAndInvalidatePreviousOtp(participant.id, OtpMethod.PHONE);

    const code = this.generateOtpCode();
    const hashedCode = await bcrypt.hash(code, 10);
    const expiresAt = new Date(
      Date.now() +
        this.config.get<number>('OTP_EXPIRY_MINUTES', 10) * 60 * 1000,
    );

    await this.prisma.otpCode.create({
      data: {
        participantId: participant.id,
        code: hashedCode,
        method: OtpMethod.PHONE,
        status: OtpStatus.PENDING,
        expiresAt,
      },
    });

    await this.sendSmsOtp(phone, code);

    return {
      message: `Code OTP envoyé au ${this.maskPhone(phone)}`,
      destination: this.maskPhone(phone),
      resendAfterSeconds: this.config.get<number>(
        'OTP_RESEND_COOLDOWN_SECONDS',
        60,
      ),
    };
  }

  // ─────────────────────────────────────────────
  // VERIFY OTP (shared for email + phone)
  // ─────────────────────────────────────────────

  async verifyOtp(dto: { email?: string; phone?: string; code: string }) {
    let participant = null;
    let method: OtpMethod;

    if (dto.email) {
      participant = await this.prisma.participant.findUnique({
        where: { email: dto.email },
      });
      method = OtpMethod.EMAIL;
    } else if (dto.phone) {
      participant = await this.prisma.participant.findUnique({
        where: { phone: dto.phone },
      });
      method = OtpMethod.PHONE;
    } else {
      throw new BadRequestException('Email ou téléphone requis');
    }

    if (!participant) {
      throw new NotFoundException('Participant introuvable');
    }

    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        participantId: participant.id,
        method,
        status: OtpStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException(
        'Aucun code OTP en attente. Veuillez en demander un nouveau.',
      );
    }

    if (otpRecord.lockedUntil && otpRecord.lockedUntil > new Date()) {
      const remainingMs = otpRecord.lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new ForbiddenException(
        `Trop de tentatives. Réessayez dans ${remainingMin} minute(s).`,
      );
    }

    if (otpRecord.expiresAt < new Date()) {
      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { status: OtpStatus.EXPIRED },
      });
      throw new BadRequestException(
        'Code OTP expiré. Veuillez en demander un nouveau.',
      );
    }

    const maxAttempts = this.config.get<number>('OTP_MAX_ATTEMPTS', 3);
    const isValid = await bcrypt.compare(dto.code, otpRecord.code);

    if (!isValid) {
      const newAttempts = otpRecord.attempts + 1;
      const updateData: any = { attempts: newAttempts };

      if (newAttempts >= maxAttempts) {
        const lockoutMinutes = this.config.get<number>(
          'OTP_LOCKOUT_MINUTES',
          5,
        );
        updateData.lockedUntil = new Date(
          Date.now() + lockoutMinutes * 60 * 1000,
        );
        await this.prisma.otpCode.update({
          where: { id: otpRecord.id },
          data: updateData,
        });
        throw new ForbiddenException(
          `Trop de tentatives. Compte bloqué ${lockoutMinutes} minutes.`,
        );
      }

      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: updateData,
      });
      const remaining = maxAttempts - newAttempts;
      throw new UnauthorizedException(
        `Code incorrect — ${remaining} tentative(s) restante(s)`,
      );
    }

    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { status: OtpStatus.VERIFIED },
    });

    return this.issueSession(participant);
  }

  // ─────────────────────────────────────────────
  // METHOD C — QR CODE SCAN
  // ─────────────────────────────────────────────

  async loginWithQr(qrToken: string) {
    let participantId: string;
    try {
      participantId = this.decryptQrToken(qrToken);
    } catch {
      throw new UnauthorizedException('QR code non reconnu ou invalide');
    }

    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, badgeQrToken: qrToken },
    });

    if (!participant) {
      throw new UnauthorizedException(
        'QR code invalide ou appartient à un autre participant',
      );
    }

    return this.issueSession(participant);
  }

  // ─────────────────────────────────────────────
  // Générer ET sauvegarder le QR token
  // ─────────────────────────────────────────────

  async generateAndSaveQrToken(participantId: string): Promise<string> {
    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      throw new NotFoundException('Participant introuvable');
    }

    const token = this.encryptQrToken(participantId);

    await this.prisma.participant.update({
      where: { id: participantId },
      data: { badgeQrToken: token },
    });

    return token;
  }

  // ─────────────────────────────────────────────
  // REFRESH TOKEN
  // ─────────────────────────────────────────────

  async refreshTokens(refreshToken: string) {
    try {
      this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: { token: refreshToken, revoked: false },
      include: { participant: true },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Session expirée. Veuillez vous reconnecter.',
      );
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revoked: true },
    });

    return this.issueSession(tokenRecord.participant);
  }

  // ─────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────

  async logout(participantId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { participantId, token: refreshToken },
        data: { revoked: true },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { participantId },
        data: { revoked: true },
      });
    }
    return { message: 'Déconnexion réussie' };
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private async issueSession(participant: any) {
    const isFirstLogin = !participant.isActive;

    if (isFirstLogin) {
      await this.prisma.participant.update({
        where: { id: participant.id },
        data: { isActive: true },
      });

      await this.notificationsService.createInAppNotification({
        participantId: participant.id,
        type: 'ACCOUNT_ACTIVATED',
        title: 'Compte activé',
        body: 'Votre compte est maintenant actif. Bienvenue !',
      });
    }

    const accessToken = this.jwt.sign(
      { sub: participant.id, email: participant.email },
      {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRY', '15m'),
      },
    );

    const refreshExpiry = this.config.get<string>('JWT_REFRESH_EXPIRY', '7d');

    const refreshToken = this.jwt.sign(
      { sub: participant.id },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiry,
      },
    );

    const refreshExpiresAt = new Date(Date.now() + ms(refreshExpiry));

    await this.prisma.refreshToken.create({
      data: {
        participantId: participant.id,
        token: refreshToken,
        expiresAt: refreshExpiresAt,
      },
    });

    const needsProfileCompletion = this.checkProfileCompletion(participant);

    return {
      accessToken,
      refreshToken,
      isFirstLogin,
      needsProfileCompletion,
      participant: this.sanitizeParticipant(participant),
    };
  }

  private checkProfileCompletion(participant: any): boolean {
    const hasPhoto = !!participant.photoUrl?.trim();
    const hasBio = !!participant.bio?.trim();
    const hasTags =
      !!participant.tags &&
      (() => {
        try {
          const parsed = JSON.parse(participant.tags);
          return Array.isArray(parsed) && parsed.length > 0;
        } catch {
          return participant.tags.trim().length > 0;
        }
      })();
    return !hasPhoto || !hasBio || !hasTags;
  }

  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async checkAndInvalidatePreviousOtp(
    participantId: string,
    method: OtpMethod,
  ) {
    await this.prisma.otpCode.updateMany({
      where: { participantId, method, status: OtpStatus.PENDING },
      data: { status: OtpStatus.EXPIRED },
    });
  }

  private maskEmail(email: string): string {
    const [user, domain] = email.split('@');
    return `${user.slice(0, 2)}***@${domain}`;
  }

  private maskPhone(phone: string): string {
    return phone.slice(0, 4) + '****' + phone.slice(-2);
  }

  // ✅ CORRIGÉ — IV déterministe : même participant = même token toujours
  private encryptQrToken(participantId: string): string {
    const secret = this.config.get<string>('QR_BADGE_SECRET');
    const iv = crypto.createHash('md5').update(participantId).digest(); // ← seul changement
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(secret.padEnd(32)),
      iv,
    );
    let encrypted = cipher.update(participantId, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptQrToken(token: string): string {
    const secret = this.config.get<string>('QR_BADGE_SECRET');
    const [ivHex, encryptedHex] = token.split(':');
    if (!ivHex || !encryptedHex) throw new Error('Invalid token format');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(secret.padEnd(32)),
      iv,
    );
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private sanitizeParticipant(p: any) {
    const { linkedinAccessToken, badgeQrToken, embeddingVector, ...safe } = p;
    return safe;
  }

  // ─────────────────────────────────────────────
  // EMAIL SENDER (SendGrid)
  // ─────────────────────────────────────────────

  private async sendEmailOtp(email: string, code: string, firstName: string) {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(this.config.get('SENDGRID_API_KEY'));

    const otpExpiryMinutes = this.config.get<number>('OTP_EXPIRY_MINUTES', 10);

    const msg = {
      to: email,
      from: {
        email: this.config.get('SENDGRID_FROM_EMAIL'),
        name: this.config.get('SENDGRID_FROM_NAME'),
      },
      subject: 'Votre code de connexion',
      html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f0ff;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="480" cellpadding="0" cellspacing="0" style="border-radius:16px;overflow:hidden;border:1px solid #e9d5ff;">
        <tr>
          <td style="background:#4a0e6e;padding:36px 32px;text-align:center;">
            <div style="color:#ffffff;font-size:24px;font-weight:bold;letter-spacing:2px;">Matchmaking App</div>
            <div style="color:rgba(255,255,255,0.6);font-size:13px;margin-top:6px;letter-spacing:1px;">Où les âmes se rencontrent</div>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">
            <p style="font-size:16px;color:#1a0a2e;margin:0 0 6px;font-weight:bold;">Bonjour ${firstName},</p>
            <p style="font-size:14px;color:#6b7280;margin:0 0 28px;line-height:1.6;">Voici votre code de connexion à votre espace personnel.</p>
            <div style="border:1.5px solid #7c3aed;border-radius:12px;padding:28px 20px;text-align:center;margin:0 0 24px;">
              <div style="font-size:11px;color:#7c3aed;letter-spacing:3px;margin-bottom:14px;font-weight:bold;">CODE DE VÉRIFICATION</div>
              <div style="font-size:46px;font-weight:bold;letter-spacing:16px;color:#4a0e6e;font-family:Georgia,serif;">${code}</div>
            </div>
            <div style="border-left:3px solid #7c3aed;padding:10px 16px;margin:0 0 28px;background:#faf5ff;border-radius:0 8px 8px 0;">
              <span style="font-size:13px;color:#4a0e6e;">Ce code expire dans <strong>${otpExpiryMinutes} minutes</strong></span>
            </div>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;">
            <p style="font-size:12px;color:#9ca3af;margin:0;line-height:1.8;">
              Si vous n'avez pas demandé ce code, ignorez cet email.<br>
              Ne partagez jamais ce code avec quiconque.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#faf5ff;padding:20px 32px;text-align:center;border-top:1px solid #e9d5ff;">
            <p style="font-size:12px;color:#9ca3af;margin:0 0 4px;">L'équipe Matchmaking App</p>
            <p style="font-size:11px;color:#c4b5d0;margin:0;">© 2026 · Tunis, Tunisie</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`,
    };

    try {
      await sgMail.send(msg);
    } catch (err: any) {
      console.error('SendGrid error:', err?.response?.body);
      throw new BadRequestException("Erreur lors de l'envoi de l'email OTP");
    }
  }

  // ─────────────────────────────────────────────
  // SMS SENDER (TunisieSMS)
  // ─────────────────────────────────────────────

  private async sendSmsOtp(phone: string, code: string) {
    const axios = require('axios');
    const baseUrl = this.config.get('TUNISIESMS_BASE_URL');
    const apiKey = this.config.get('TUNISIESMS_API_KEY');
    const sender = this.config.get('TUNISIESMS_SENDER');
    const otpExpiryMinutes = this.config.get<number>('OTP_EXPIRY_MINUTES', 10);

    const message = `Votre code de connexion: ${code}. Valable ${otpExpiryMinutes} min.`;

    try {
      await axios.get(`${baseUrl}/SMS`, {
        params: {
          key: apiKey,
          to: phone,
          from: sender,
          msg: message,
        },
      });
    } catch (err: any) {
      console.error('TunisieSMS error:', err?.message);
      throw new BadRequestException("Erreur lors de l'envoi du SMS OTP");
    }
  }
}