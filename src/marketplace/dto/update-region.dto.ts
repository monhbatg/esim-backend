import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRegionDto {
  @ApiPropertyOptional({
    example: 'Asia',
    description: 'Region name in English',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name_en?: string;

  @ApiPropertyOptional({
    example: 'Ази',
    description: 'Region name in Mongolian',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name_mn?: string;
}

