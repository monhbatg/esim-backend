import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CountryFilterDto {
  @ApiProperty({ example: 1, description: 'Country ID' })
  id: number;

  @ApiProperty({ example: 'Thailand', description: 'Country name in English' })
  name_en: string;

  @ApiProperty({ example: 'Тайланд', description: 'Country name in Mongolian' })
  name_mn: string;

  @ApiPropertyOptional({
    example: 'TH',
    description: 'Country code (ISO 2-letter code)',
    nullable: true,
  })
  country_code: string | null;

  @ApiPropertyOptional({
    example: '/img/flags/th.png',
    description: 'Country image URL',
    nullable: true,
  })
  image: string | null;
}

export class CategoryFilterDto {
  @ApiProperty({ example: 1, description: 'Category ID' })
  id: number;

  @ApiProperty({ example: 'Top Destinations', description: 'Category name in English' })
  name_en: string;

  @ApiProperty({ example: 'Шилдэг чиглэлүүд', description: 'Category name in Mongolian' })
  name_mn: string;

  @ApiPropertyOptional({
    example: 'Most popular travel destinations',
    description: 'Category description in English',
    nullable: true,
  })
  description_en: string | null;

  @ApiPropertyOptional({
    example: 'Алдартай аялалын чиглэлүүд',
    description: 'Category description in Mongolian',
    nullable: true,
  })
  description_mn: string | null;
}

