// src/auth/dto/index.ts
import { IsEmail, IsString, IsOptional, Length, IsMobilePhone } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestEmailOtpDto {
  @ApiProperty({ example: 'participant@example.com' })
  @IsEmail({}, { message: 'Email invalide' })
  email: string;
}

export class RequestPhoneOtpDto {
  @ApiProperty({ example: '+21698765432' })
  @IsString()
  phone: string;
}

export class VerifyOtpDto {
  @ApiPropertyOptional({ example: 'participant@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+21698765432' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'Le code OTP doit contenir exactement 6 chiffres' })
  code: string;
}

export class QrLoginDto {
  @ApiProperty({ example: 'encrypted-qr-token-from-badge' })
  @IsString()
  qrToken: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}