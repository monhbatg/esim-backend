import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for eSIM order
 */
export class OrderEsimResponseDto {
  @ApiProperty({
    example: 'B23051616050537',
    description: 'Order number from eSIM provider',
  })
  orderNo: string;

  @ApiProperty({
    example: 'TXN-20240101-ABC123',
    description: 'Transaction ID used for the order',
  })
  transactionId: string;

  @ApiProperty({
    example: 15000,
    description: 'Total amount charged',
  })
  amount: number;

  @ApiProperty({
    example: 'COMPLETED',
    description: 'Transaction status',
  })
  transactionStatus: string;

  @ApiProperty({
    example: 100.0,
    description: 'Balance before transaction',
  })
  balanceBefore: number;

  @ApiProperty({
    example: 85.0,
    description: 'Balance after transaction',
  })
  balanceAfter: number;
}
