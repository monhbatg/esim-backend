import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WalletStatusResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Wallet ID',
  })
  id: string;

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
    description: 'Wallet currency',
  })
  currency: string;

  @ApiProperty({
    example: true,
    description: 'Whether the wallet is active',
  })
  isActive: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether the wallet is frozen',
  })
  isFrozen: boolean;

  @ApiPropertyOptional({
    example: 'Suspicious activity detected',
    description: 'Reason for freezing the wallet',
    nullable: true,
  })
  frozenReason?: string | null;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Wallet creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
