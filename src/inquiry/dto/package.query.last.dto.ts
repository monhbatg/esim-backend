import { IsOptional, IsString, IsInt } from 'class-validator';

export class PackageQueryLastDto {
  @IsOptional()
  @IsString()
  locationCode?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  packageCode?: string;

  @IsOptional()
  @IsString()
  iccid?: string;

  @IsOptional()
  @IsInt()
  page?: number;

  @IsOptional()
  @IsInt()
  limit?: number;
}