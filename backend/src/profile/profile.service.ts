// src/profile/profile.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateProfileDto } from './dto';

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
    const { linkedinAccessToken, badgeQrToken, embeddingVector, ...safe } = participant;
    return { participant: safe };
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
      },
    });
    const { linkedinAccessToken, badgeQrToken, embeddingVector, ...safe } = participant;
    return { participant: safe };
  }

  async updatePhoto(participantId: string, file: Express.Multer.File) {
    // ✅ Upload to Cloudinary — returns secure CDN URL
    const result = await this.cloudinary.uploadImage(file, 'profile-photos');
    const photoUrl = result.secure_url; // e.g. https://res.cloudinary.com/dhtce8tnl/...

    const participant = await this.prisma.participant.update({
      where: { id: participantId },
      data: { photoUrl },
    });
    const { linkedinAccessToken, badgeQrToken, embeddingVector, ...safe } = participant;
    return { participant: safe, photoUrl };
  }
}