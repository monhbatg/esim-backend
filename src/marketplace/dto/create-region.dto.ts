import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRegionDto {
  @ApiProperty({
    example: 'Asia',
    description: 'Region name in English',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name_en: string;

  @ApiProperty({
    example: 'Ази',
    description: 'Region name in Mongolian',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name_mn: string;
}
