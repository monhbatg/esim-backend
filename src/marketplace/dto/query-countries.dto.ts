import { IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryCountriesDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Filter countries by region ID',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  region_id?: number;
}
