import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LinkedInController } from './linkedin.controller';
import { LinkedInService } from './linkedin.service';  // ← add this

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [ProfileController, LinkedInController],
  providers: [ProfileService, LinkedInService],  // ← removed LinkedInController, added LinkedInService
  exports: [ProfileService],
})
export class ProfileModule {}