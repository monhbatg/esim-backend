import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for balance operations
 *
 * @example
 * {
 *   "userId": "123e4567-e89b-12d3-a456-426614174000",
 *   "balance": 150.75,
 *   "currency": "USD"
 * }
 */
export class BalanceResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'User ID',
  })
  userId: string;

  @ApiProperty({
    example: 150.75,
    description: 'Current wallet balance',
  })
  balance: number;

  @ApiProperty({
    example: 'USD',
    description: 'Currency of the balance',
  })
  currency: string;
}

/**
 * Response DTO for add balance operation
 *
 * @example
 * {
 *   "userId": "123e4567-e89b-12d3-a456-426614174000",
 *   "previousBalance": 50.25,
 *   "amountAdded": 100.50,
 *   "newBalance": 150.75,
 *   "currency": "USD"
 * }
 */
export class AddBalanceResponseDto extends BalanceResponseDto {
  @ApiProperty({
    example: 50.25,
    description: 'Balance before adding the amount',
  })
  previousBalance: number;

  @ApiProperty({
    example: 100.5,
    description: 'Amount that was added',
  })
  amountAdded: number;
}
