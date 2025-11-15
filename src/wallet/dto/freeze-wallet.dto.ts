import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class FreezeWalletDto {
  @ApiPropertyOptional({
    description: 'Reason for freezing the wallet',
    example: 'Suspicious activity detected',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Reason must not exceed 500 characters',
  })
  reason?: string;
}

