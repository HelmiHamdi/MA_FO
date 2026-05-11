// src/profile/profile.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateProfileDto } from './dto';

// Champs sensibles à toujours exclure avant de retourner au client
const SENSITIVE_FIELDS = [
  'linkedinAccessToken',
  'badgeQrToken',
  'embeddingVector',
] as const;

function stripSensitive(participant: Record<string, any>) {
  const safe = { ...participant };
  for (const field of SENSITIVE_FIELDS) {
    delete safe[field];
  }
  return safe;
}

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async getMe(participantId: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
    });
    if (!participant) throw new NotFoundException('Participant introuvable');
    return { participant: stripSensitive(participant as any) };
  }

  async updateProfile(participantId: string, dto: UpdateProfileDto) {
    const participant = await this.prisma.participant.update({
      where: { id: participantId },
      data: {
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.jobTitle !== undefined && { jobTitle: dto.jobTitle }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
        ...(dto.hasSeenProfilePrompt !== undefined && {
          hasSeenProfilePrompt: dto.hasSeenProfilePrompt,
        }),
      },
    });
    return { participant: stripSensitive(participant as any) };
  }

  async markProfilePromptSeen(participantId: string) {
    const participant = await this.prisma.participant.update({
      where: { id: participantId },
      data: { hasSeenProfilePrompt: true },
    });
    return { participant: stripSensitive(participant as any) };
  }

  async updatePhoto(participantId: string, file: Express.Multer.File) {
    const result = await this.cloudinary.uploadImage(file, 'profile-photos');
    const photoUrl = result.secure_url;

    const participant = await this.prisma.participant.update({
      where: { id: participantId },
      data: { photoUrl },
    });
    return { participant: stripSensitive(participant as any), photoUrl };
  }
}