import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for purchasing an eSIM card
 * Contains eSIM package details and purchase information
 *
 * @example
 * {
 *   "packageCode": "CKH491",
 *   "slug": "NA-3_1_7",
 *   "packageName": "North America 1GB 7Days",
 *   "price": 57.00,
 *   "currency": "USD",
 *   "dataVolume": 1073741824,
 *   "duration": 7,
 *   "durationUnit": "DAY",
 *   "location": "MX,US,CA",
 *   "description": "North America 1GB 7Days"
 * }
 */
export class PurchaseEsimDto {
  @ApiProperty({
    example: 'CKH491',
    description: 'eSIM package code',
  })
  @IsNotEmpty({ message: 'Package code is required' })
  @IsString()
  packageCode: string;

  @ApiProperty({
    example: 'NA-3_1_7',
    description: 'Package slug identifier',
  })
  @IsNotEmpty({ message: 'Package slug is required' })
  @IsString()
  slug: string;

  @ApiProperty({
    example: 'North America 1GB 7Days',
    description: 'Package name',
  })
  @IsNotEmpty({ message: 'Package name is required' })
  @IsString()
  packageName: string;

  @ApiProperty({
    example: 57.0,
    description: 'Package price at time of purchase',
    minimum: 0.01,
  })
  @IsNotEmpty({ message: 'Price is required' })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Price must be a valid number with up to 2 decimal places' },
  )
  @Type(() => Number)
  @IsPositive({ message: 'Price must be greater than 0' })
  @Min(0.01, { message: 'Price must be at least 0.01' })
  price: number;

  @ApiProperty({
    example: 'USD',
    description: 'Currency code',
  })
  @IsNotEmpty({ message: 'Currency is required' })
  @IsString()
  currency: string;

  @ApiProperty({
    example: 1073741824,
    description: 'Data volume in bytes',
  })
  @IsNotEmpty({ message: 'Data volume is required' })
  @IsNumber()
  @Type(() => Number)
  @IsPositive({ message: 'Data volume must be greater than 0' })
  dataVolume: number;

  @ApiProperty({
    example: 7,
    description: 'Duration value',
  })
  @IsNotEmpty({ message: 'Duration is required' })
  @IsNumber()
  @Type(() => Number)
  @IsPositive({ message: 'Duration must be greater than 0' })
  duration: number;

  @ApiProperty({
    example: 'DAY',
    description: 'Duration unit (DAY, MONTH, etc.)',
  })
  @IsNotEmpty({ message: 'Duration unit is required' })
  @IsString()
  durationUnit: string;

  @ApiProperty({
    example: 'MX,US,CA',
    description: 'Covered locations (comma-separated country codes)',
  })
  @IsNotEmpty({ message: 'Location is required' })
  @IsString()
  location: string;

  @ApiPropertyOptional({
    example: 'North America 1GB 7Days',
    description: 'Package description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: {
      locationNetworkList: [
        {
          locationName: 'United States',
          locationLogo: '/img/flags/us.png',
          operatorList: [
            {
              operatorName: 'Verizon',
              networkType: '5G',
            },
          ],
        },
      ],
    },
    description: 'Full package metadata (operators, networks, etc.)',
  })
  @IsOptional()
  packageMetadata?: Record<string, any>;
}

