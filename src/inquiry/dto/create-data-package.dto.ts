import { ApiProperty } from '@nestjs/swagger';
import { CreateDataPackageLocationDto } from './create-data-package-location.dto';

export class CreateDataPackageDto {
  @ApiProperty()
  packageCode: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  currencyCode: string;

  @ApiProperty()
  volume: number;

  @ApiProperty()
  smsStatus: number;

  @ApiProperty()
  dataType: number;

  @ApiProperty()
  unusedValidTime: number;

  @ApiProperty()
  duration: number;

  @ApiProperty()
  durationUnit: string;

  @ApiProperty()
  location: string;

  @ApiProperty()
  locationCode: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  activeType: number;

  @ApiProperty()
  favorite: boolean;

  @ApiProperty()
  retailPrice: number;

  @ApiProperty()
  speed: string;

  @ApiProperty()
  ipExport: string;

  @ApiProperty()
  supportTopUpType: number;

  @ApiProperty()
  fupPolicy: string;

  @ApiProperty({ type: [CreateDataPackageLocationDto] })
  locationNetworkList: CreateDataPackageLocationDto[];
}
