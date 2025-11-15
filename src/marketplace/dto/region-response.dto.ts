import { ApiProperty } from '@nestjs/swagger';

export class RegionResponseDto {
  @ApiProperty({ example: 1, description: 'Region ID' })
  id: number;

  @ApiProperty({ example: 'Asia', description: 'Region name in English' })
  name_en: string;

  @ApiProperty({ example: 'Ази', description: 'Region name in Mongolian' })
  name_mn: string;

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

