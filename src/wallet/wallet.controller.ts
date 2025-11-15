import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthRequest } from '../auth/interfaces/auth-request.interface';
import { UserRole } from '../users/dto/user-role.enum';
import { WalletService } from './wallet.service';
import { AddBalanceDto } from '../users/dto/add-balance.dto';
import {
  BalanceResponseDto,
  AddBalanceResponseDto,
} from '../users/dto/balance-response.dto';
import { WalletOwnershipGuard } from './guards/wallet-ownership.guard';
import { FreezeWalletDto } from './dto/freeze-wallet.dto';
import { WalletStatusResponseDto } from './dto/wallet-status-response.dto';

@ApiTags('wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * POST /wallet/user-profile/:id/add-balance
   *
   * Add balance to a user's wallet
   *
   * @example Request:
   * POST /wallet/user-profile/123e4567-e89b-12d3-a456-426614174000/add-balance
   * Body: { "amount": 100.50 }
   *
   * @example Response:
   * {
   *   "userId": "123e4567-e89b-12d3-a456-426614174000",
   *   "previousBalance": 50.25,
   *   "amountAdded": 100.50,
   *   "balance": 150.75,
   *   "currency": "USD"
   * }
   */
  @Post('user-profile/:id/add-balance')
  @UseGuards(WalletOwnershipGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add balance to user wallet',
    description:
      "Add funds to a user's wallet balance. Amount must be greater than 0.",
  })
  @ApiBody({ type: AddBalanceDto })
  @ApiResponse({
    status: 200,
    description: 'Balance added successfully',
    type: AddBalanceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid amount (must be > 0) or wallet is frozen',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - You can only access your own wallet',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Balance update conflict (optimistic locking)',
  })
  async addBalance(
    @Param('id') userId: string,
    @Body(ValidationPipe) addBalanceDto: AddBalanceDto,
  ): Promise<AddBalanceResponseDto> {
    // Get current balance before adding
    const previousBalance = await this.walletService.getBalance(userId);

    // Add balance
    const wallet = await this.walletService.addBalance(
      userId,
      addBalanceDto.amount,
    );

    return {
      userId: wallet.userId,
      previousBalance: Number(previousBalance),
      amountAdded: addBalanceDto.amount,
      balance: Number(wallet.balance),
      currency: wallet.currency,
    };
  }

  /**
   * GET /wallet/user-profile/:id/balance
   *
   * Get user's current wallet balance
   *
   * @example Request:
   * GET /wallet/user-profile/123e4567-e89b-12d3-a456-426614174000/balance
   *
   * @example Response:
   * {
   *   "userId": "123e4567-e89b-12d3-a456-426614174000",
   *   "balance": 150.75,
   *   "currency": "USD"
   * }
   */
  @Get('user-profile/:id/balance')
  @UseGuards(WalletOwnershipGuard)
  @ApiOperation({
    summary: 'Get user wallet balance',
    description: 'Retrieve the current wallet balance for a user',
  })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
    type: BalanceResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - You can only access your own wallet',
  })
  @ApiResponse({
    status: 404,
    description: 'User or wallet not found',
  })
  async getBalance(@Param('id') userId: string): Promise<BalanceResponseDto> {
    const { balance, currency } =
      await this.walletService.getBalanceWithCurrency(userId);

    return {
      userId,
      balance,
      currency,
    };
  }

  /**
   * GET /wallet/me
   *
   * Get current authenticated user's wallet balance
   */
  @Get('me')
  @ApiOperation({
    summary: 'Get current user wallet balance',
    description: 'Retrieve the wallet balance for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
    type: BalanceResponseDto,
  })
  async getMyBalance(@Request() req: AuthRequest): Promise<BalanceResponseDto> {
    const { balance, currency } =
      await this.walletService.getBalanceWithCurrency(req.user.id);

    return {
      userId: req.user.id,
      balance,
      currency,
    };
  }

  /**
   * PATCH /wallet/admin/:userId/freeze
   *
   * Freeze a user's wallet (Admin only)
   *
   * @example Request:
   * PATCH /wallet/admin/123e4567-e89b-12d3-a456-426614174000/freeze
   * Body: { "reason": "Suspicious activity detected" }
   *
   * @example Response:
   * {
   *   "id": "wallet-uuid",
   *   "userId": "123e4567-e89b-12d3-a456-426614174000",
   *   "balance": 150.75,
   *   "currency": "USD",
   *   "isActive": true,
   *   "isFrozen": true,
   *   "frozenReason": "Suspicious activity detected",
   *   "createdAt": "2024-01-01T00:00:00.000Z",
   *   "updatedAt": "2024-01-01T00:00:00.000Z"
   * }
   */
  @Patch('admin/:userId/freeze')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Freeze user wallet (Admin only)',
    description:
      'Freeze a user wallet to prevent transactions. Only admins can perform this action.',
  })
  @ApiBody({ type: FreezeWalletDto })
  @ApiResponse({
    status: 200,
    description: 'Wallet frozen successfully',
    type: WalletStatusResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'User or wallet not found',
  })
  async freezeWallet(
    @Param('userId') userId: string,
    @Body(ValidationPipe) freezeWalletDto: FreezeWalletDto,
  ): Promise<WalletStatusResponseDto> {
    const wallet = await this.walletService.freezeWallet(
      userId,
      freezeWalletDto.reason,
    );

    return {
      id: wallet.id,
      userId: wallet.userId,
      balance: Number(wallet.balance),
      currency: wallet.currency,
      isActive: wallet.isActive,
      isFrozen: wallet.isFrozen,
      frozenReason: wallet.frozenReason,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  /**
   * PATCH /wallet/admin/:userId/unfreeze
   *
   * Unfreeze a user's wallet (Admin only)
   *
   * @example Request:
   * PATCH /wallet/admin/123e4567-e89b-12d3-a456-426614174000/unfreeze
   *
   * @example Response:
   * {
   *   "id": "wallet-uuid",
   *   "userId": "123e4567-e89b-12d3-a456-426614174000",
   *   "balance": 150.75,
   *   "currency": "USD",
   *   "isActive": true,
   *   "isFrozen": false,
   *   "frozenReason": null,
   *   "createdAt": "2024-01-01T00:00:00.000Z",
   *   "updatedAt": "2024-01-01T00:00:00.000Z"
   * }
   */
  @Patch('admin/:userId/unfreeze')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unfreeze user wallet (Admin only)',
    description:
      'Unfreeze a user wallet to allow transactions again. Only admins can perform this action.',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet unfrozen successfully',
    type: WalletStatusResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'User or wallet not found',
  })
  async unfreezeWallet(
    @Param('userId') userId: string,
  ): Promise<WalletStatusResponseDto> {
    const wallet = await this.walletService.unfreezeWallet(userId);

    return {
      id: wallet.id,
      userId: wallet.userId,
      balance: Number(wallet.balance),
      currency: wallet.currency,
      isActive: wallet.isActive,
      isFrozen: wallet.isFrozen,
      frozenReason: wallet.frozenReason,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }
}
