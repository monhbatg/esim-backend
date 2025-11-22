import { IsOptional, IsString, IsInt, Min, IsDateString, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for pagination parameters
 */
export class PagerDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (starts from 1)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNum?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}

/**
 * DTO for querying eSIM purchases
 */
export class QueryEsimDto {
  @ApiPropertyOptional({
    example: 'B23120118131854',
    description: 'Order number from eSIM provider',
  })
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiPropertyOptional({
    example: '23120118156818',
    description: 'eSIM transaction number',
  })
  @IsOptional()
  @IsString()
  esimTranNo?: string;

  @ApiPropertyOptional({
    example: '8943108170000775671',
    description: 'eSIM ICCID',
  })
  @IsOptional()
  @IsString()
  iccid?: string;

  @ApiPropertyOptional({
    example: '2023-12-01T00:00:00+00:00',
    description: 'Starting time (ISO UTC time)',
  })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({
    example: '2023-12-31T23:59:59+00:00',
    description: 'End time (ISO UTC time)',
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Page parameters (mandatory per API spec, but optional in implementation with defaults)',
    type: PagerDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PagerDto)
  pager?: PagerDto;
}

