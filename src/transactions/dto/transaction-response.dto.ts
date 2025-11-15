import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TransactionType,
  TransactionStatus,
} from '../../users/dto/transaction-types.enum';
import { ESimInfoDto } from './esim-info.dto';

/**
 * Response DTO for transaction operations
 *
 * @example
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000",
 *   "transactionId": "TXN-20240101-ABC123",
 *   "userId": "user-uuid",
 *   "type": "WITHDRAWAL",
 *   "status": "COMPLETED",
 *   "amount": 50.00,
 *   "currency": "USD",
 *   "balanceBefore": 100.00,
 *   "balanceAfter": 50.00,
 *   "description": "Purchase eSIM package",
 *   "referenceId": "ORDER-12345",
 *   "createdAt": "2024-01-01T10:00:00.000Z",
 *   "completedAt": "2024-01-01T10:00:01.000Z"
 * }
 */
export class TransactionResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Transaction internal ID',
  })
  id: string;

  @ApiProperty({
    example: 'TXN-20240101-ABC123',
    description: 'Unique transaction identifier',
  })
  transactionId: string;

  @ApiProperty({
    example: 'user-uuid',
    description: 'User ID who made the transaction',
  })
  userId: string;

  @ApiProperty({
    example: TransactionType.WITHDRAWAL,
    description: 'Transaction type',
    enum: TransactionType,
  })
  type: TransactionType;

  @ApiProperty({
    example: TransactionStatus.COMPLETED,
    description: 'Transaction status',
    enum: TransactionStatus,
  })
  status: TransactionStatus;

  @ApiProperty({
    example: 50.0,
    description: 'Transaction amount',
  })
  amount: number;

  @ApiProperty({
    example: 'USD',
    description: 'Currency',
  })
  currency: string;

  @ApiPropertyOptional({
    example: 100.0,
    description: 'Balance before transaction',
    nullable: true,
  })
  balanceBefore: number | null;

  @ApiPropertyOptional({
    example: 50.0,
    description: 'Balance after transaction',
    nullable: true,
  })
  balanceAfter: number | null;

  @ApiPropertyOptional({
    example: 'Purchase eSIM package',
    description: 'Transaction description',
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    example: 'ORDER-12345',
    description: 'External reference ID',
    nullable: true,
  })
  referenceId: string | null;

  @ApiPropertyOptional({
    example: { orderId: '12345' },
    description: 'Additional metadata',
    nullable: true,
  })
  metadata: Record<string, any> | null;

  @ApiPropertyOptional({
    example: 'Insufficient balance',
    description: 'Failure reason if transaction failed',
    nullable: true,
  })
  failureReason: string | null;

  @ApiProperty({
    example: '2024-01-01T10:00:00.000Z',
    description: 'Transaction creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T10:00:01.000Z',
    description: 'Transaction update timestamp',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    example: '2024-01-01T10:00:01.000Z',
    description: 'Transaction completion timestamp',
    nullable: true,
  })
  completedAt: Date | null;

  @ApiPropertyOptional({
    type: ESimInfoDto,
    description:
      'eSIM purchase information (if this transaction is for eSIM purchase)',
    nullable: true,
  })
  esimInfo?: ESimInfoDto | null;
}

/**
 * Response DTO for transaction list queries
 */
export class TransactionListResponseDto {
  @ApiProperty({
    type: [TransactionResponseDto],
    description: 'List of transactions',
  })
  transactions: TransactionResponseDto[];

  @ApiProperty({
    example: 100,
    description: 'Total number of transactions',
  })
  total: number;

  @ApiProperty({
    example: 1,
    description: 'Current page number',
  })
  page: number;

  @ApiProperty({
    example: 10,
    description: 'Number of items per page',
  })
  limit: number;

  @ApiProperty({
    example: 10,
    description: 'Total number of pages',
  })
  totalPages: number;
}
