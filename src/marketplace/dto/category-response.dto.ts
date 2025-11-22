import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ example: 1, description: 'Category ID' })
  id: number;

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
    example: 'Popular travel destinations',
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
