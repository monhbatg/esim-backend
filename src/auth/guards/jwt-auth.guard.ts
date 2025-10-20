import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TokenBlacklistService } from '../services/token-blacklist.service';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Check if token is blacklisted
    if (this.tokenBlacklistService.isBlacklisted(token)) {
      throw new UnauthorizedException('Token has been invalidated');
    }

    // Call the parent canActivate to perform JWT validation
    const can = super.canActivate(context);
    // Nest types allow Observable<boolean>, normalize to Promise<boolean>
    if (typeof (can as any).subscribe === 'function') {
      return new Promise<boolean>((resolve, reject) => {
        (can as any).subscribe({ next: resolve, error: reject });
      });
    }
    return can as boolean | Promise<boolean>;
  }
}
