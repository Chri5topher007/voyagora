
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getMe(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, profileImageUrl: true, bio: true, subscriptionStatus: true }
    });
  }

  async updateMe(id: string, dto: { name?: string; bio?: string; profileImageUrl?: string }) {
    return this.prisma.user.update({
      where: { id },
      data: { name: dto.name, bio: dto.bio, profileImageUrl: dto.profileImageUrl },
      select: { id: true, name: true, email: true, role: true, profileImageUrl: true, bio: true, subscriptionStatus: true }
    });
  }
}
