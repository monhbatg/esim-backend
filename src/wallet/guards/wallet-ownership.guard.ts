import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthRequest } from '../../auth/interfaces/auth-request.interface';

/**
 * Guard to ensure users can only access their own wallet
 * Use this guard on routes that accept userId as parameter
 */
@Injectable()
export class WalletOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const userId = request.params?.id || request.params?.userId;
    const authenticatedUserId = request.user?.id;

    // If no userId in params, allow (will use authenticated user's ID)
    if (!userId) {
      return true;
    }

    // Check if user is trying to access their own wallet
    if (userId !== authenticatedUserId) {
      throw new ForbiddenException('You can only access your own wallet');
    }

    return true;
  }
}
