import { IsOptional, IsNumber, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryMarketplaceDto {
  @ApiPropertyOptional({
    example: 1,
    description:
      'Filter by category ID (returns only countries in this category)',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  category_id?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Filter by region ID (returns only countries in this region). Can be combined with category_id.',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  region_id?: number;

  @ApiPropertyOptional({
    example: 'thailand',
    description:
      'Search countries by name (searches both English and Mongolian names)',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
