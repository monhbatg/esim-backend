import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Top Destinations',
    description: 'Category name in English',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name_en: string;

  @ApiProperty({
    example: 'Шилдэг чиглэлүүд',
    description: 'Category name in Mongolian',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name_mn: string;

  @ApiPropertyOptional({
    example: 'Popular travel destinations',
    description: 'Category description in English',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description_en?: string | null;

  @ApiPropertyOptional({
    example: 'Алдартай аялалын чиглэлүүд',
    description: 'Category description in Mongolian',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description_mn?: string | null;
}
