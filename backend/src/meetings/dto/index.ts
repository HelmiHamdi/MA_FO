// src/meetings/dto/index.ts
import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsIn,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

// ─── 5.1 Meeting Request ──────────────────────────────────────────────────────

export class RequestMeetingDto {
  @ApiProperty({
    description: 'UUID du participant destinataire',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsNotEmpty()
  receiverId: string;

  @ApiProperty({
    description: 'UUID du créneau sélectionné',
    example: 'slot-uuid-xxxx',
  })
  @IsString()
  @IsNotEmpty()
  slotId: string;

  @ApiPropertyOptional({
    description:
      'Message de demande personnalisé. Si absent, généré par GPT-4o depuis le profil ou auto-généré.',
    example: 'Je souhaite échanger sur notre potentiel partenariat stratégique.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

// ─── 5.2 Respond to Meeting ───────────────────────────────────────────────────

export class RespondMeetingDto {
  @ApiProperty({
    description: "Action du récepteur : accepter ou refuser la demande",
    enum: ['CONFIRMED', 'CANCELLED'],
    example: 'CONFIRMED',
  })
  @IsString()
  @IsIn(['CONFIRMED', 'CANCELLED'])
  action: 'CONFIRMED' | 'CANCELLED';

  @ApiPropertyOptional({
    description: 'Raison du refus (optionnel, uniquement si action = CANCELLED)',
    example: 'Je suis déjà pris sur ce créneau.',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

// ─── 5.3 Reschedule Meeting ───────────────────────────────────────────────────

export class RescheduleMeetingDto {
  @ApiProperty({
    description: 'UUID du nouveau créneau choisi',
    example: 'new-slot-uuid-xxxx',
  })
  @IsString()
  @IsNotEmpty()
  newSlotId: string;
}

// ─── 5.4 Rate Meeting ─────────────────────────────────────────────────────────

export class RateMeetingDto {
  @ApiProperty({
    description: 'Note de 1 à 5 étoiles',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;

  @ApiPropertyOptional({
    description: 'Commentaire libre (max 200 caractères)',
    example: 'Très bonne rencontre, échange très constructif.',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  comment?: string;
}

// ─── 5.5 Scan Table QR ───────────────────────────────────────────────────────

export class ScanTableQrDto {
  @ApiProperty({
    description: "Token QR unique de la table physique scanné par l'appareil",
    example: 'QR_TABLE_07_SALLE_A_ENCRYPTED_TOKEN',
  })
  @IsString()
  @IsNotEmpty()
  qrToken: string;

  @ApiProperty({
    description: 'UUID de la réunion en cours à confirmer',
    example: 'meeting-uuid-xxxx',
  })
  @IsString()
  @IsNotEmpty()
  meetingId: string;
}

// ─── Query: Available Slots ───────────────────────────────────────────────────

export class GetSlotsQueryDto {
  @ApiProperty({
    description: 'UUID du participant avec qui on souhaite se réunir',
    example: 'participant-uuid-xxxx',
  })
  @IsString()
  @IsNotEmpty()
  receiverId: string;
}

// ─── Admin: Create Meeting (admin only) ───────────────────────────────────────

export class AdminCreateMeetingDto {
  @ApiProperty({ example: 'participant-a-uuid' })
  @IsString()
  @IsNotEmpty()
  requesterId: string;

  @ApiProperty({ example: 'participant-b-uuid' })
  @IsString()
  @IsNotEmpty()
  receiverId: string;

  @ApiProperty({ example: 'slot-uuid' })
  @IsString()
  @IsNotEmpty()
  slotId: string;

  @ApiPropertyOptional({ example: "Réunion organisée par l'équipe événement" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  requestMessage?: string;
}