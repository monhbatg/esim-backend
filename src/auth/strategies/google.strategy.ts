import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { User } from '../../entities/user.entity';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly enabled: boolean;
  private readonly logger = new Logger(GoogleStrategy.name);
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL =
      configService.get<string>('GOOGLE_CALLBACK_URL') ??
      '/auth/google/callback';

    const enabled = Boolean(clientID && clientSecret);
    // Keep a flag to short-circuit validate when not configured
    // Use placeholder values to avoid constructor throwing when not configured
    super({
      clientID: clientID ?? 'disabled',
      clientSecret: clientSecret ?? 'disabled',
      callbackURL,
      scope: ['email', 'profile'],
      passReqToCallback: false,
    });
    this.enabled = enabled;

    if (!this.enabled) {
      this.logger.warn(
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable.',
      );
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): Promise<User> {
    if (!this.enabled) {
      throw new UnauthorizedException('Google OAuth is not configured');
    }
    const emails = profile.emails ?? [];
    const primaryEmail = emails[0]?.value;

    return await this.usersService.upsertFromGoogleProfile({
      googleId: profile.id,
      email: primaryEmail ?? '',
      firstName: profile.name?.givenName ?? profile.displayName ?? 'Google',
      lastName: profile.name?.familyName ?? 'User',
    });
  }
}
