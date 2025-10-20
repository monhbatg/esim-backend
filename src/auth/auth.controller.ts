import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Request,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
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
    const authHeader = req.headers['authorization'] as string | undefined;
    const token = authHeader?.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const response: { message: string } = await this.authService.logout(token);
    return { message: response.message };
  }
}
