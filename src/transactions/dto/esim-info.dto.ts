import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * eSIM information included in transaction response
 * Shows what eSIM card was purchased in this transaction
 */
export class ESimInfoDto {
  @ApiProperty({
    example: 'CKH491',
    description: 'eSIM package code',
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
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'eSIM purchase ID',
  })
  purchaseId?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether eSIM has been activated',
  })
  isActivated?: boolean;

  @ApiPropertyOptional({
    example: '2024-01-08T10:00:00.000Z',
    description: 'When eSIM expires',
    nullable: true,
  })
  expiresAt?: Date | null;
}
