import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignUpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email',
    required: true,
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'Phone number (international format supported)',
    required: true,
  })
  @IsString()
  @MinLength(7, { message: 'Phone number must be at least 7 characters long' })
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  @Matches(
    /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
    {
      message: 'Please provide a valid phone number',
    },
  )
  phoneNumber: string;

  @ApiProperty({
    example: 'P@ssw0rd!23',
    description:
      'Password with at least 8 chars, incl. upper, lower, number, special',
    required: true,
    minLength: 8,
    maxLength: 100,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(100, { message: 'Password must not exceed 100 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @ApiProperty({ example: 'John', description: 'First name', required: true })
  @IsString()
  @MinLength(2, { message: 'First name must be at least 2 characters long' })
  @MaxLength(50, { message: 'First name must not exceed 50 characters' })
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name', required: true })
  @IsString()
  @MinLength(2, { message: 'Last name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Last name must not exceed 50 characters' })
  lastName: string;
}
