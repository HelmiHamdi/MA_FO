// src/chat/dto/index.ts
import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  MaxLength,
  IsNotEmpty,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Send Message ─────────────────────────────────────────────────────────────

export class SendMessageDto {
  @ApiProperty({
    description: 'Contenu du message texte',
    example: 'Bonjour, ravi de vous retrouver ici !',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;

  @ApiPropertyOptional({
    description: 'Type de message',
    enum: ['TEXT', 'SYSTEM'],
    default: 'TEXT',
  })
  @IsOptional()
  @IsIn(['TEXT', 'SYSTEM'])
  type?: 'TEXT' | 'SYSTEM';

  @ApiPropertyOptional({
    description: 'Métadonnées JSON optionnelles',
  })
  @IsOptional()
  @IsString()
  metadata?: string;
}

// ─── Get Messages Query ───────────────────────────────────────────────────────

export class GetMessagesQueryDto {
  @ApiPropertyOptional({ description: 'Curseur pour pagination (createdAt ISO)', example: '2024-01-15T10:00:00.000Z' })
  @IsOptional()
  @IsString()
  before?: string;

  @ApiPropertyOptional({ description: 'Nombre de messages par page', default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

// ─── Mark Read ────────────────────────────────────────────────────────────────

export class MarkReadDto {
  @ApiProperty({
    description: 'UUID du dernier message lu (tous les messages avant ce point seront marqués lus)',
    example: 'msg-uuid-xxxx',
  })
  @IsString()
  @IsNotEmpty()
  lastReadMessageId: string;
}