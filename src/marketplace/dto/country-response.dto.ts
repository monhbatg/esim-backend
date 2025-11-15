import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegionResponseDto } from './region-response.dto';

export class CountryResponseDto {
  @ApiProperty({ example: 1, description: 'Country ID' })
  id: number;

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

  @ApiProperty({ example: 1, description: 'Region ID' })
  region_id: number;

  @ApiProperty({
    example: 'TH',
    description: 'Country code (ISO 2-letter code)',
  })
  country_code: string;

  @ApiPropertyOptional({
    type: RegionResponseDto,
    description: 'Region information',
  })
  region?: RegionResponseDto;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
