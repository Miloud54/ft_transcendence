import { Body, Controller, Get, Patch, Req, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  getMe(@Req() req: Request) {
    const { userId } = req.user as { userId: string };
    return this.userService.findById(userId);
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
