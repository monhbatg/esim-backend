import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubLocationDto {
  @ApiProperty({
    description: 'Country/region code',
    example: 'IS',
  })
  code: string;

  @ApiProperty({
    description: 'Country/region name',
    example: 'Iceland',
  })
  name: string;
}

export class LocationDto {
  @ApiProperty({
    description: 'Location code',
    example: 'ES',
  })
  code: string;

  @ApiProperty({
    description: 'Location name',
    example: 'Spain',
  })
  name: string;

  @ApiProperty({
    description: 'Location type: 1 = single country, 2 = multi-country bundle',
    example: 1,
  })
  type: number;

  @ApiPropertyOptional({
    type: [SubLocationDto],
    description: 'Sub-locations (for type 2 bundles)',
    example: [
      { code: 'IS', name: 'Iceland' },
      { code: 'IE', name: 'Ireland' },
    ],
  })
  subLocationList?: SubLocationDto[] | null;
}

export class LocationListResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Error code',
    example: '0',
  })
  errorCode: string;

  @ApiPropertyOptional({
    description: 'Error message',
    example: null,
  })
  errorMsg?: string | null;

  @ApiProperty({
    type: 'object',
    description: 'Response data object',
    properties: {
      locationList: {
        type: 'array',
        items: { $ref: '#/components/schemas/LocationDto' },
      },
    },
  })
  obj: {
    locationList: LocationDto[];
  };
}
