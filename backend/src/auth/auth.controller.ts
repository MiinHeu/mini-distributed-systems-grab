import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { AuthService } from './auth.service';
import { ok } from '../common/api-response';
import { RequestUser } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';

class RegisterDto {
  @IsString()
  name?: string;

  @IsString()
  phone?: string;

  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(6)
  password?: string;

  @IsEnum(['customer', 'driver', 'admin'])
  @IsOptional()
  role?: 'customer' | 'driver' | 'admin';

  @IsEnum(['vi', 'en'])
  @IsOptional()
  preferred_language?: 'vi' | 'en';

  @IsNumber()
  @IsOptional()
  latitude?: number;
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  vehicle_plate?: string;

  @IsString()
  @IsOptional()
  vehicle_type?: string;
}

class LoginDto {
  @IsEmail()
  email?: string;

  @IsString()
  password?: string;
}

class PatchMeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(['vi', 'en'])
  @IsOptional()
  preferred_language?: 'vi' | 'en';
}

type RequestWithAuth = Request & {
  user?: RequestUser;
  token?: string;
};

const AVATAR_DIR = join(process.cwd(), 'uploads', 'avatars');
mkdirSync(AVATAR_DIR, { recursive: true });

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    const data = await this.authService.register(body);
    return ok(data);
  }

  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const data = await this.authService.login(body, acceptLanguage);
    return ok(data);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() request: RequestWithAuth,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    if (!request.token) {
      throw new UnauthorizedException('missing token');
    }

    const data = this.authService.logout(request.token, acceptLanguage);
    return ok(data);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: RequestWithAuth) {
    if (!request.user) {
      throw new UnauthorizedException('unauthorized');
    }

    const data = await this.authService.me(request.user);
    return ok(data);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async patchMe(@Req() request: RequestWithAuth, @Body() body: PatchMeDto) {
    if (!request.user) {
      throw new UnauthorizedException('unauthorized');
    }

    const data = await this.authService.patchMe(request.user, body);
    return ok(data);
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: AVATAR_DIR,
        filename: (_req, file, callback) => {
          const stamp = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `${stamp}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async uploadAvatar(
    @Req() request: RequestWithAuth,
    @Headers('accept-language') acceptLanguage?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!request.user) {
      throw new UnauthorizedException('unauthorized');
    }

    if (!file) {
      throw new BadRequestException('avatar file is required');
    }

    const avatarUrl = `/uploads/avatars/${file.filename}`;
    const data = await this.authService.updateAvatar(
      request.user,
      avatarUrl,
      acceptLanguage,
    );
    return ok(data);
  }
}
