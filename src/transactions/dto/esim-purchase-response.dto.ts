import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionResponseDto } from './transaction-response.dto';

/**
 * Response DTO for eSIM purchase
 * Includes both transaction and eSIM purchase details
 */
export class ESimPurchaseResponseDto {
  @ApiProperty({
    type: TransactionResponseDto,
    description: 'Transaction details',
    nullable: true,
  })
  transaction: TransactionResponseDto | null;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'eSIM purchase ID',
  })
  purchaseId: string;

  @ApiProperty({
    example: 'CKH491',
    description: 'Package code',
  })
  packageCode: string;

  @ApiProperty({
    example: 'NA-3_1_7',
    description: 'Package slug',
  })
  slug: string;

  @ApiProperty({
    example: 'North America 1GB 7Days',
    description: 'Package name',
  })
  packageName: string;

  @ApiProperty({
    example: 57.0,
    description: 'Price paid',
  })
  price: number;

  @ApiProperty({
    example: 'USD',
    description: 'Currency',
  })
  currency: string;

  @ApiProperty({
    example: 1073741824,
    description: 'Data volume in bytes',
  })
  dataVolume: number;

  @ApiProperty({
    example: 7,
    description: 'Duration value',
  })
  duration: number;

  @ApiProperty({
    example: 'DAY',
    description: 'Duration unit',
  })
  durationUnit: string;

  @ApiProperty({
    example: 'MX,US,CA',
    description: 'Covered locations',
  })
  location: string;

  @ApiPropertyOptional({
    example: 'North America 1GB 7Days',
    description: 'Package description',
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    example: '89014103211118510720',
    description: 'ICCID of the eSIM card (after activation)',
    nullable: true,
  })
  iccid: string | null;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether eSIM has been activated',
  })
  isActivated: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether eSIM is currently active',
  })
  isActive: boolean;

  @ApiPropertyOptional({
    example: '2024-01-01T10:00:00.000Z',
    description: 'When eSIM was activated',
    nullable: true,
  })
  activatedAt: Date | null;

  @ApiPropertyOptional({
    example: '2024-01-08T10:00:00.000Z',
    description: 'When eSIM expires',
    nullable: true,
  })
  expiresAt: Date | null;

  @ApiProperty({
    example: '2024-01-01T10:00:00.000Z',
    description: 'Purchase date',
  })
  purchasedAt: Date;
}

