// src/meetings/dto/index.ts
import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestMeetingDto {
  @ApiProperty({ example: 'participant-uuid' })
  @IsString()
  receiverId: string;

  @ApiProperty({ example: 'slot-uuid' })
  @IsString()
  slotId: string;

  @ApiPropertyOptional({ example: 'Je souhaite discuter de notre partenariat potentiel.' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class RespondMeetingDto {
  @ApiProperty({ enum: ['CONFIRMED', 'CANCELLED'] })
  @IsString()
  action: 'CONFIRMED' | 'CANCELLED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RescheduleMeetingDto {
  @ApiProperty({ example: 'new-slot-uuid' })
  @IsString()
  newSlotId: string;
}

export class RateMeetingDto {
  @ApiProperty({ example: 4, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;

  @ApiPropertyOptional({ example: 'Très bonne rencontre, très professionnel.' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class ScanTableQrDto {
  @ApiProperty({ example: 'table-qr-encrypted-token' })
  @IsString()
  qrToken: string;

  @ApiProperty({ example: 'meeting-uuid' })
  @IsString()
  meetingId: string;
}

export class GetSlotsQueryDto {
  @ApiProperty({ example: 'participant-uuid' })
  @IsString()
  receiverId: string;
}