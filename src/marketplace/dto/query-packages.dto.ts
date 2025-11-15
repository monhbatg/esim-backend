import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryPackagesDto {
  @ApiProperty({
    example: 'TH',
    description:
      'Country code (ISO 2-letter code) to fetch eSIM packages for. Must match a country_code from the marketplace.',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  country_code: string;
}

