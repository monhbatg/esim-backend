import { IsString, IsNumber, IsOptional, MinLength, MaxLength, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCountryDto {
  @ApiProperty({
    example: 'Thailand',
    description: 'Country name in English',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name_en: string;

  @ApiProperty({
    example: 'Тайланд',
    description: 'Country name in Mongolian',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name_mn: string;

  @ApiProperty({
    example: 1,
    description: 'Region ID',
  })
  @IsNumber()
  @Type(() => Number)
  region_id: number;

  @ApiProperty({
    example: 'TH',
    description: 'Country code (ISO 2-letter code)',
  })
  @IsString()
  @Length(2, 2)
  country_code: string;

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

