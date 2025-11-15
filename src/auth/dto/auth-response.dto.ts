import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/dto/user-role.enum';

export class AuthResponseDto {
  @Expose()
  @ApiProperty({ example: 'uuid', description: 'User ID' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  email: string;

  @Expose()
  @ApiProperty({ example: 'John', description: 'First name' })
  firstName: string;

  @Expose()
  @ApiProperty({ example: 'Doe', description: 'Last name' })
  lastName: string;

  @Expose()
  @ApiProperty({ example: true, description: 'Account active status' })
  isActive: boolean;

  @Expose()
  @ApiProperty({
    enum: UserRole,
    example: UserRole.USER,
    description: 'User role',
  })
  role: UserRole;

  @Expose()
  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Last login timestamp',
    nullable: true,
  })
  lastLoginAt: Date;

  @Expose()
  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Account creation timestamp',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token',
  })
  accessToken: string;

  @Expose()
  @ApiProperty({
    example: 'Bearer',
    description: 'Token type',
    default: 'Bearer',
  })
  tokenType: string = 'Bearer';

  @Expose()
  @ApiProperty({
    example: 3600,
    description: 'Token expiration time in seconds',
  })
  expiresIn: number;
}
