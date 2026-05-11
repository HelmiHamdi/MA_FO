// src/profile/profile.controller.ts
import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/index';

@ApiTags('Profile Module')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get('me')
  @ApiOperation({ summary: 'Récupérer mon profil' })
  getMe(@GetUser('id') participantId: string) {
    return this.profileService.getMe(participantId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Mettre à jour mon profil' })
  updateProfile(
    @GetUser('id') participantId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(participantId, dto);
  }

  // IMPORTANT: cette route doit être AVANT :id generics — pas de conflit ici
  // mais rappel de bonne pratique NestJS: routes statiques avant paramétriques
  @Patch('me/prompt-seen')
  @ApiOperation({ summary: 'Marquer le profile prompt comme vu' })
  markPromptSeen(@GetUser('id') participantId: string) {
    return this.profileService.markProfilePromptSeen(participantId);
  }

  @Post('me/photo')
  @ApiOperation({ summary: 'Upload photo de profil (Cloudinary)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(
            new BadRequestException('Seules les images sont acceptées'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadPhoto(
    @GetUser('id') participantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu');
    return this.profileService.updatePhoto(participantId, file);
  }
}