import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '../../generated/prisma';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserError } from '../common/user-error';
import { isPasswordTooLong } from './password.rule';
import { isTokenOfType, TokenPayload } from './token';

export type OAuthProfile = {
  provider: 'google' | 'discord';
  providerId: string;
  email?: string;
  displayName?: string;
  avatar?: string;
};

const SALT_ROUNDS = 10;
const DEFAULT_AVATAR =
  'https://api.dicebear.com/10.x/critters/svg?seed=default';

type UserRecord = {
  user_id: bigint;
  username: string;
  email: string;
  avatar: string;
  xp: bigint;
  lvl: bigint;
  status: UserStatus;
  last_seen_at: Date;
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
    // Emails are stored in lowercase; usernames keep their case but are unique
    // whatever the case ("Alice" and "alice" cannot both exist).
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          { username: { equals: dto.username, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      throw new UserError(
        existing.email.toLowerCase() === email
          ? 'This email is already used by another account'
          : 'This username is already taken',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email,
        password: hashedPassword,
        avatar: DEFAULT_AVATAR,
        xp: 0n,
        lvl: 1n,
        status: UserStatus.ONLINE,
      },
    });

    const activeUser = await this.markOnline(user.user_id);
    return this.buildAuthResponse(activeUser);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email.trim(), mode: 'insensitive' } },
    });

    // bcrypt would only compare the first 72 bytes: a longer password is wrong.
    if (!user || !user.password || isPasswordTooLong(dto.password)) {
      throw new UserError('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatches) {
      throw new UserError('Invalid email or password');
    }

    const activeUser = await this.markOnline(user.user_id);
    return this.buildAuthResponse(activeUser);
  }

  refresh(refreshToken: string) {
    let payload: TokenPayload;

    try {
      payload = this.jwtService.verify<TokenPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (!isTokenOfType(payload, 'refresh')) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const accessToken = this.jwtService.sign({
      sub: payload.sub,
      email: payload.email,
      type: 'access',
    } satisfies TokenPayload);

    return { accessToken };
  }

  async loginWithOAuth(profile: OAuthProfile) {
    let user =
      profile.provider === 'google'
        ? await this.prisma.user.findUnique({
            where: { googleId: profile.providerId },
          })
        : await this.prisma.user.findUnique({
            where: { discordId: profile.providerId },
          });

    if (!user && profile.email) {
      const existingByEmail = await this.prisma.user.findFirst({
        where: { email: { equals: profile.email, mode: 'insensitive' } },
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

      const username = await this.generateUniqueUsername(
        profile.displayName ?? profile.provider,
      );

      user =
        profile.provider === 'google'
          ? await this.prisma.user.create({
              data: {
                username,
                email: profile.email.toLowerCase(),
                password: null,
                avatar: DEFAULT_AVATAR,
                xp: 0n,
                lvl: 1n,
                status: UserStatus.ONLINE,
                googleId: profile.providerId,
              },
            })
          : await this.prisma.user.create({
              data: {
                username,
                email: profile.email.toLowerCase(),
                password: null,
                avatar: DEFAULT_AVATAR,
                xp: 0n,
                lvl: 1n,
                status: UserStatus.ONLINE,
                discordId: profile.providerId,
              },
            });
    }

    const activeUser = await this.markOnline(user.user_id);
    return this.buildAuthResponse(activeUser);
  }

  private markOnline(userId: bigint) {
    return this.prisma.user.update({
      where: { user_id: userId },
      data: { status: UserStatus.ONLINE, last_seen_at: new Date() },
    });
  }

  private async generateUniqueUsername(base: string) {
    const sanitized =
      base.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'player';
    let username = sanitized;
    let suffix = 0;

    while (
      await this.prisma.user.findFirst({
        where: { username: { equals: username, mode: 'insensitive' } },
      })
    ) {
      suffix += 1;
      username = `${sanitized}${suffix}`;
    }

    return username;
  }

  private buildAuthResponse(user: UserRecord) {
    const publicUser = toPublicUser(user);
    const payload = { sub: publicUser.id, email: publicUser.email };

    const accessToken = this.jwtService.sign({
      ...payload,
      type: 'access',
    } satisfies TokenPayload);
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' } satisfies TokenPayload,
      { expiresIn: '7d' },
    );

    return { user: publicUser, accessToken, refreshToken };
  }
}
