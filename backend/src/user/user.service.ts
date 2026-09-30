import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '../../generated/prisma';
import { UpdateUserDto } from './dto/update-user.dto';

type UserRecord = {
  user_id: bigint;
  username: string;
  email: string;
  avatar: string;
  xp: bigint;
  lvl: bigint;
  status: UserStatus;
};

function toPublicUser(user: UserRecord) {
  return {
    id: user.user_id.toString(),
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    xp: Number(user.xp),
    lvl: Number(user.lvl),
    status: user.status,
  };
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: BigInt(userId) },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toPublicUser(user);
  }

  async update(userId: string, dto: UpdateUserDto) {
    if (dto.username || dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: {
          user_id: { not: BigInt(userId) },
          OR: [
            ...(dto.username ? [{ username: dto.username }] : []),
            ...(dto.email ? [{ email: dto.email }] : []),
          ],
        },
      });

      if (existing) {
        throw new ConflictException('Username or email already in use');
      }
    }

    const user = await this.prisma.user.update({
      where: { user_id: BigInt(userId) },
      data: dto,
    });

    return toPublicUser(user);
  }
}
