import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { SignInDto } from './dto/signin.dto';
import { SignUpDto } from './dto/signup.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthRequest } from './interfaces/auth-request.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signUp(
    @Body(ValidationPipe) signUpDto: SignUpDto,
  ): Promise<AuthResponseDto> {
    return await this.authService.signUp(signUpDto);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body(ValidationPipe) signInDto: SignInDto,
  ): Promise<AuthResponseDto> {
    return await this.authService.signIn(signInDto);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Request() req: AuthRequest,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    return await this.authService.refreshToken(req.user.id);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(
    @Request() req: AuthRequest,
  ): Omit<AuthResponseDto, 'accessToken' | 'tokenType' | 'expiresIn'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userProfile } = req.user;
    return userProfile;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: AuthRequest): Promise<{ message: string }> {
    // Extract token from Authorization header
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader?.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const response: { message: string } = await this.authService.logout(token);
    return { message: response.message };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  // This route triggers the OAuth flow
  async googleAuth(): Promise<void> {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(
    @Request() req: AuthRequest,
  ): Promise<AuthResponseDto> {
    // req.user is set by GoogleStrategy.validate and is a User entity
    const user = req.user;
    const { accessToken, expiresIn } = await this.authService.refreshToken(
      user.id,
    );

    const userResponse = plainToClass(AuthResponseDto, user, {
      excludeExtraneousValues: true,
    });

    return {
      ...userResponse,
      accessToken,
      expiresIn,
    };
  }
}
