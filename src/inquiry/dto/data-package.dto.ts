import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OperatorDto {
  @ApiProperty({
    description: 'Operator name',
    example: 'Verizon',
  })
  operatorName: string;

  @ApiProperty({
    description: 'Network type',
    example: '5G',
  })
  networkType: string;
}

export class LocationNetworkDto {
  @ApiProperty({
    description: 'Location name',
    example: 'United States',
  })
  locationName: string;

  @ApiProperty({
    description: 'Location flag logo URL',
    example: '/img/flags/us.png',
  })
  locationLogo: string;

  @ApiProperty({
    type: [OperatorDto],
    description: 'List of operators in this location',
  })
  operatorList: OperatorDto[];
}

export class DataPackageDto {
  @ApiProperty({
    description: 'Package code',
    example: 'CKH491',
  })
  packageCode: string;

  @ApiProperty({
    description: 'Package slug identifier',
    example: 'NA-3_1_7',
  })
  slug: string;

  @ApiProperty({
    description: 'Package name',
    example: 'North America 1GB 7Days',
  })
  name: string;

  @ApiProperty({
    description: 'Price',
    example: 57000,
  })
  price: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currencyCode: string;

  @ApiProperty({
    description: 'Data volume in bytes',
    example: 1073741824,
  })
  volume: number;

  @ApiPropertyOptional({
    description: 'SMS status flag',
    example: 1,
  })
  smsStatus?: number;

  @ApiPropertyOptional({
    description: 'Data type',
    example: 1,
  })
  dataType?: number;

  @ApiPropertyOptional({
    description: 'Unused valid time in days',
    example: 180,
  })
  unusedValidTime?: number;

  @ApiProperty({
    description: 'Duration value',
    example: 7,
  })
  duration: number;

  @ApiProperty({
    description: 'Duration unit',
    example: 'DAY',
  })
  durationUnit: string;

  @ApiProperty({
    description: 'Covered locations (comma-separated country codes)',
    example: 'MX,US,CA',
  })
  location: string;

  @ApiProperty({
    description: 'Package description',
    example: 'North America 1GB 7Days',
  })
  description: string;

  @ApiPropertyOptional({
    description: 'Active type',
    example: 2,
  })
  activeType?: number;

  @ApiPropertyOptional({
    description: 'Is favorite package',
    example: true,
  })
  favorite?: boolean;

  @ApiPropertyOptional({
    description: 'Retail price',
    example: 114000,
  })
  retailPrice?: number;

  @ApiPropertyOptional({
    description: 'Network speed',
    example: '3G/4G',
  })
  speed?: string;

  @ApiProperty({
    type: [LocationNetworkDto],
    description: 'Location and network details',
  })
  locationNetworkList: LocationNetworkDto[];
}

export class ApiDataObject {
  @ApiProperty({
    type: [DataPackageDto],
    description: 'List of packages',
  })
  packageList: DataPackageDto[];
}
