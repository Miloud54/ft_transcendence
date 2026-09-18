import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
// import { UserStatus } from '../../generated/prisma';
import { UserStatus } from '../../generated/prisma/enums';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;
const DEFAULT_AVATAR = 'https://api.dicebear.com/9.x/identicon/svg?seed=default';

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
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });

    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        avatar: DEFAULT_AVATAR,
        xp: 0n,
        lvl: 1n,
        status: UserStatus.ONLINE,
      },
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: UserRecord) {
    const publicUser = toPublicUser(user);

    const accessToken = this.jwtService.sign({
      sub: publicUser.id,
      email: publicUser.email,
    });

    return { user: publicUser, accessToken };
  }
}