import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { plainToClass } from 'class-transformer';
import { User } from '../entities/user.entity';
import { TokenBlacklistService } from './services/token-blacklist.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  async signUp(signUpDto: SignUpDto): Promise<AuthResponseDto> {
    try {
      // Create user
      const user = await this.usersService.create(signUpDto);

      // Generate JWT token
      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };
      const accessToken = this.jwtService.sign(payload);

      // Update last login
      await this.usersService.updateLastLogin(user.id);

      // Transform user data and return response
      const userResponse = plainToClass(AuthResponseDto, user, {
        excludeExtraneousValues: true,
      });

      return {
        ...userResponse,
        accessToken,
        expiresIn: 3600, // 1 hour
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new BadRequestException('User with this email already exists');
      }
      throw error instanceof Error
        ? error
        : new Error('Unknown error occurred');
    }
  }

  async signIn(signInDto: SignInDto): Promise<AuthResponseDto> {
    // Find user by email with password included
    const user = await this.usersService.findByEmail(signInDto.email, true);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Validate password
    const isPasswordValid = await user.validatePassword(signInDto.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload);

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    // Transform user data and return response
    const userResponse = plainToClass(AuthResponseDto, user, {
      excludeExtraneousValues: true,
    });

    return {
      ...userResponse,
      accessToken,
      expiresIn: 3600, // 1 hour
    };
  }

  async validateUser(payload: { sub: string; email: string }): Promise<User> {
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }

  async refreshToken(
    userId: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const user = await this.usersService.findById(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      expiresIn: 3600, // 1 hour
    };
  }

  /**
   * Logout user by adding their token to the blacklist
   * @param token - The JWT token to invalidate
   * @returns Success message
   */
  logout(token: string): { message: string } {
    // Add token to blacklist
    this.tokenBlacklistService.addToBlacklist(token);

    return {
      message: 'Successfully logged out',
    };
  }
}
