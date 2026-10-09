import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { PresenceGateway } from './presence.gateway';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly presenceGateway: PresenceGateway,
  ) {}

  @Get('me')
  getMe(@Req() req: Request) {
    const { userId } = req.user as { userId: string };
    return this.userService.findById(userId);
  }

  @Get('search')
  search(@Req() req: Request, @Query('q') query = '') {
    const { userId } = req.user as { userId: string };
    return this.userService.search(userId, query);
  }

  @Get('me/friends')
  getFriends(@Req() req: Request) {
    const { userId } = req.user as { userId: string };
    return this.userService.getFriends(userId);
  }

  @Get('me/friend-requests')
  getFriendRequests(@Req() req: Request) {
    const { userId } = req.user as { userId: string };
    return this.userService.getFriendRequests(userId);
  }

  @Post('me/friends/:friendId')
  async addFriend(@Req() req: Request, @Param('friendId') friendId: string) {
    const { userId } = req.user as { userId: string };
    const result = await this.userService.addFriend(userId, friendId);
    const requester = await this.userService.findById(userId);
    this.presenceGateway.notifyUser(friendId, 'friend-request:received', requester);
    return result;
  }

  @Delete('me/friends/:friendId')
  async removeFriend(@Req() req: Request, @Param('friendId') friendId: string) {
    const { userId } = req.user as { userId: string };
    const result = await this.userService.removeFriend(userId, friendId);
    this.presenceGateway.notifyUser(userId, 'friend:removed', result);
    this.presenceGateway.notifyUser(friendId, 'friend:removed', result);
    return result;
  }

  @Patch('me/friend-requests/:requesterId/accept')
  async acceptFriendRequest(@Req() req: Request, @Param('requesterId') requesterId: string) {
    const { userId } = req.user as { userId: string };
    const result = await this.userService.acceptFriendRequest(userId, requesterId);
    const acceptedBy = await this.userService.findById(userId);
    this.presenceGateway.notifyUser(requesterId, 'friend-request:accepted', acceptedBy);
    return result;
  }

  @Post('me/friend-requests/:requesterId/decline')
  async declineFriendRequest(@Req() req: Request, @Param('requesterId') requesterId: string) {
    const { userId } = req.user as { userId: string };
    const result = await this.userService.declineFriendRequest(userId, requesterId);
    this.presenceGateway.notifyUser(requesterId, 'friend-request:declined', {
      id: userId,
    });
    return result;
  }

  @Patch('me/presence')
  updatePresence(@Req() req: Request) {
    const { userId } = req.user as { userId: string };
    return this.userService.updatePresence(userId);
  }

  @Patch('me')
  updateMe(@Req() req: Request, @Body() dto: UpdateUserDto) {
    const { userId } = req.user as { userId: string };
    return this.userService.update(userId, dto);
  }

  @Patch('me/password')
  changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const { userId } = req.user as { userId: string };
    return this.userService.changePassword(userId, dto);
  }

  @Patch('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: (req, file, callback) => {
          const dir = './uploads/avatars';
          fs.mkdirSync(dir, { recursive: true });
          callback(null, dir);
        },
        filename: (req, file, callback) => {
          const { userId } = (req as Request).user as { userId: string };
          callback(null, `${userId}-${Date.now()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new Error('Only image files are allowed'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadAvatar(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    const { userId } = req.user as { userId: string };
    return this.userService.updateAvatar(userId, file.filename);
  }
}
