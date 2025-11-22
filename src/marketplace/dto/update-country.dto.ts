import {
  IsString,
  IsNumber,
  IsOptional,
  MinLength,
  MaxLength,
  Length,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateCountryDto {
  @ApiPropertyOptional({
    example: 'Thailand',
    description: 'Country name in English',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name_en?: string;

  @ApiPropertyOptional({
    example: 'Тайланд',
    description: 'Country name in Mongolian',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name_mn?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Region ID',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  region_id?: number;

  @ApiPropertyOptional({
    example: 'TH',
    description: 'Country code (ISO 2-letter code)',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country_code?: string;

  @ApiPropertyOptional({
    example: '/img/flags/th.png',
    description: 'Country image URL',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string | null;
}
