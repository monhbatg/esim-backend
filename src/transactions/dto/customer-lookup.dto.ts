import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CustomerLookupDto {
  @ApiProperty({
    example: 'customer@example.com',
    description: 'Customer email address',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '99112233',
    description: 'Customer phone number',
    required: false,
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

