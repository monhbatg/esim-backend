import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNumber, IsOptional, IsString } from 'class-validator';

export class CustomerPurchaseDto {
  @ApiProperty({ example: '99112233' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'JC053' })
  @IsString()
  packageCode: string;

  @ApiProperty({ example: 'Payment for eSIM', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
