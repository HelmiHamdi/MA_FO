// src/discovery/dto/index.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SwipeAction } from '@prisma/client';
import { Transform } from 'class-transformer';

export class SwipeDto {
  @ApiProperty({ example: 'participant-uuid' })
  @IsString()
  targetParticipantId: string;

  @ApiProperty({ enum: SwipeAction })
  @IsEnum(SwipeAction)
  action: SwipeAction;

  @ApiProperty({ example: 'batch-uuid' })
  @IsString()
  batchId: string;
}

export class ViewAllFilterDto {
  @ApiPropertyOptional({ example: 'Tech' })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiPropertyOptional({ example: 'TN' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'VIP' })
  @IsOptional()
  @IsString()
  profileType?: string;

  @ApiPropertyOptional({ example: 'developer' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: '["startup","fintech"]' })
  @IsOptional()
  tags?: string;

  @ApiPropertyOptional({ example: 'true' })
  @IsOptional()
  showConnected?: string;

  @ApiPropertyOptional({ example: 'investors in renewable energy' })
  @IsOptional()
  @IsString()
  aiPrompt?: string;

  @ApiPropertyOptional({ example: 'john doe' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class ConnectionRequestDto {
  @ApiProperty({ example: 'participant-uuid' })
  @IsString()
  targetParticipantId: string;
}

export class RespondConnectionDto {
  @ApiProperty({ enum: ['ACCEPTED', 'REJECTED'] })
  @IsEnum(['ACCEPTED', 'REJECTED'])
  action: 'ACCEPTED' | 'REJECTED';
}