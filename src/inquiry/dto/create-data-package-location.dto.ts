import { ApiProperty } from '@nestjs/swagger';

export class CreateDataPackageOperatorDto {
  @ApiProperty()
  operatorName: string;

  @ApiProperty()
  networkType: string;
}

export class CreateDataPackageLocationDto {
  @ApiProperty()
  locationName: string;

  @ApiProperty()
  locationLogo: string;

  @ApiProperty()
  locationCode: string;

  @ApiProperty({ type: [CreateDataPackageOperatorDto] })
  operatorList: CreateDataPackageOperatorDto[];
}
