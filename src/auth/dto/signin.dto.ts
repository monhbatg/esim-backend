import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignInDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email',
    required: true,
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    example: 'P@ssw0rd!23',
    description: 'User password',
    required: true,
  })
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string;
}
