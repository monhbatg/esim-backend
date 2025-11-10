import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  IsOptional,
  Min,
  Max,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TransactionType } from '../../users/dto/transaction-types.enum';

/**
 * DTO for creating a new transaction
 *
 * @example
 * {
 *   "type": "WITHDRAWAL",
 *   "amount": 50.00,
 *   "description": "Purchase eSIM package",
 *   "referenceId": "ORDER-12345"
 * }
 */
export class CreateTransactionDto {
  @ApiProperty({
    example: TransactionType.WITHDRAWAL,
    description: 'Type of transaction',
    enum: TransactionType,
  })
  @IsNotEmpty({ message: 'Transaction type is required' })
  @IsEnum(TransactionType, {
    message: 'Transaction type must be a valid type',
  })
  type: TransactionType;

  @ApiProperty({
    example: 50.0,
    description: 'Transaction amount',
    minimum: 0.01,
    maximum: 100000,
  })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must be a valid number with up to 2 decimal places' },
  )
  @Type(() => Number)
  @IsPositive({ message: 'Amount must be greater than 0' })
  @Min(0.01, { message: 'Amount must be at least 0.01' })
  @Max(100000, { message: 'Amount cannot exceed 100,000 per transaction' })
  amount: number;

  @ApiPropertyOptional({
    example: 'Purchase eSIM package for North America',
    description: 'Transaction description',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    example: 'ORDER-12345',
    description: 'External reference ID (e.g., order ID, payment ID)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Reference ID cannot exceed 100 characters' })
  referenceId?: string;

  @ApiPropertyOptional({
    example: { orderId: '12345', packageCode: 'NA-3_1_7' },
    description: 'Additional metadata for the transaction',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

