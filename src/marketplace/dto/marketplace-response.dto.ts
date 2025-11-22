import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MarketplaceRegionDto {
  @ApiProperty({ example: 'Asia', description: 'Region name in English' })
  name_en: string;

  @ApiProperty({ example: 'Ази', description: 'Region name in Mongolian' })
  name_mn: string;
}

export class MarketplaceCountryDto {
  @ApiProperty({ example: 'Thailand', description: 'Country name in English' })
  name_en: string;

  @ApiProperty({ example: 'Тайланд', description: 'Country name in Mongolian' })
  name_mn: string;

  @ApiPropertyOptional({
    example: '/img/flags/th.png',
    description: 'Country image URL',
    nullable: true,
  })
  image: string | null;

  @ApiPropertyOptional({
    example: 'TH',
    description: 'Country code (ISO 2-letter code)',
    nullable: true,
  })
  country_code: string | null;

  @ApiProperty({
    type: () => MarketplaceRegionDto,
    description: 'Region information',
  })
  region: MarketplaceRegionDto;
}

export class MarketplaceCategoryDto {
  @ApiProperty({
    example: 'Top Destinations',
    description: 'Category name in English',
  })
  name_en: string;

  @ApiProperty({
    example: 'Шилдэг чиглэлүүд',
    description: 'Category name in Mongolian',
  })
  name_mn: string;

  @ApiPropertyOptional({
    example:
      'Most popular travel destinations for Mongolians based on bookings and trends.',
    description: 'Category description in English',
    nullable: true,
  })
  description_en: string | null;

  @ApiPropertyOptional({
    example: 'Монголчуудын хамгийн их аялдаг, эрэлттэй чиглэлүүд.',
    description: 'Category description in Mongolian',
    nullable: true,
  })
  description_mn: string | null;

  @ApiProperty({
    type: [MarketplaceCountryDto],
    description: 'Countries in this category',
  })
  countries: MarketplaceCountryDto[];
}
