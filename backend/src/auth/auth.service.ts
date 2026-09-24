import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '../../generated/prisma';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

type RefreshPayload = { sub: string; email: string };

export type OAuthProfile = {
  provider: 'google' | 'discord';
  providerId: string;
  email?: string;
  displayName?: string;
  avatar?: string;
};

const SALT_ROUNDS = 10;
const DEFAULT_AVATAR =
  'https://api.dicebear.com/9.x/identicon/svg?seed=default';

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
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  async refresh(refreshToken: string) {
    let payload: RefreshPayload;

    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const accessToken = this.jwtService.sign({
      sub: payload.sub,
      email: payload.email,
    });

    return { accessToken };
  }

  async loginWithOAuth(profile: OAuthProfile) {
    let user =
      profile.provider === 'google'
        ? await this.prisma.user.findUnique({ where: { googleId: profile.providerId } })
        : await this.prisma.user.findUnique({ where: { discordId: profile.providerId } });

    if (!user && profile.email) {
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (existingByEmail) {
        user =
          profile.provider === 'google'
            ? await this.prisma.user.update({
                where: { user_id: existingByEmail.user_id },
                data: { googleId: profile.providerId },
              })
            : await this.prisma.user.update({
                where: { user_id: existingByEmail.user_id },
                data: { discordId: profile.providerId },
              });
      }
    }

    if (!user) {
      if (!profile.email) {
        throw new UnauthorizedException(
          `Your ${profile.provider} account has no public email to sign up with`,
        );
      }

      const username = await this.generateUniqueUsername(profile.displayName ?? profile.provider);

      user =
        profile.provider === 'google'
          ? await this.prisma.user.create({
              data: {
                username,
                email: profile.email,
                password: null,
                avatar: profile.avatar ?? DEFAULT_AVATAR,
                xp: 0n,
                lvl: 1n,
                status: UserStatus.ONLINE,
                googleId: profile.providerId,
              },
            })
          : await this.prisma.user.create({
              data: {
                username,
                email: profile.email,
                password: null,
                avatar: profile.avatar ?? DEFAULT_AVATAR,
                xp: 0n,
                lvl: 1n,
                status: UserStatus.ONLINE,
                discordId: profile.providerId,
              },
            });
    }

    return this.buildAuthResponse(user);
  }

  private async generateUniqueUsername(base: string) {
    const sanitized = base.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'player';
    let username = sanitized;
    let suffix = 0;

    while (await this.prisma.user.findUnique({ where: { username } })) {
      suffix += 1;
      username = `${sanitized}${suffix}`;
    }

    return username;
  }

  private buildAuthResponse(user: UserRecord) {
    const publicUser = toPublicUser(user);
    const payload = { sub: publicUser.id, email: publicUser.email };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return { user: publicUser, accessToken, refreshToken };
  }
}
