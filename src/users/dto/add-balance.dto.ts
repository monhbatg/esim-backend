import {
  IsNumber,
  IsPositive,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for adding balance to a user's wallet
 * 
 * @example
 * {
 *   "amount": 100.50
 * }
 */
export class AddBalanceDto {
  @ApiProperty({
    example: 100.5,
    description: 'Amount to add to the wallet balance',
    minimum: 0.01,
    maximum: 1000000,
  })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must be a valid number with up to 2 decimal places' },
  )
  @Type(() => Number)
  @IsPositive({ message: 'Amount must be greater than 0' })
  @Min(0.01, { message: 'Amount must be at least 0.01' })
  @Max(1000000, { message: 'Amount cannot exceed 1,000,000' })
  amount: number;
}

