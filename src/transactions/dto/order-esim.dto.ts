import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsPositive,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for package information in eSIM order
 */
export class PackageInfoDto {
  @ApiProperty({
    example: '7aa948d363',
    description: 'eSIM package code',
  })
  @IsNotEmpty({ message: 'Package code is required' })
  @IsString()
  packageCode: string;

  @ApiProperty({
    example: 1,
    description: 'Number of profiles to order',
    minimum: 1,
  })
  @IsNotEmpty({ message: 'Count is required' })
  @IsNumber({}, { message: 'Count must be a number' })
  @IsPositive({ message: 'Count must be greater than 0' })
  @Min(1, { message: 'Count must be at least 1' })
  count: number;

  @ApiProperty({
    example: 15000,
    description: 'Price per package (in smallest currency unit, e.g., cents)',
    minimum: 0.01,
  })
  @IsNotEmpty({ message: 'Price is required' })
  @IsNumber({}, { message: 'Price must be a number' })
  @IsPositive({ message: 'Price must be greater than 0' })
  @Min(0.01, { message: 'Price must be at least 0.01' })
  price: number;
}

/**
 * DTO for ordering eSIM profiles
 */
export class OrderEsimDto {
  @ApiPropertyOptional({
    example: 'TXN-20240101-ABC123',
    description:
      'Unique transaction ID for this order. If not provided, will be auto-generated.',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({
    example: 15000,
    description:
      'Total amount for the order (sum of all package prices * count)',
    minimum: 0.01,
  })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber({}, { message: 'Amount must be a number' })
  @IsPositive({ message: 'Amount must be greater than 0' })
  @Min(0.01, { message: 'Amount must be at least 0.01' })
  amount: number;

  @ApiProperty({
    type: [PackageInfoDto],
    description: 'List of packages to order',
    example: [
      {
        packageCode: '7aa948d363',
        count: 1,
        price: 15000,
      },
    ],
  })
  @IsNotEmpty({ message: 'Package info list is required' })
  @IsArray({ message: 'Package info list must be an array' })
  @ArrayMinSize(1, { message: 'At least one package is required' })
  @ValidateNested({ each: true })
  @Type(() => PackageInfoDto)
  packageInfoList: PackageInfoDto[];
}
