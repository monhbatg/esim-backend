import { ApiProperty } from '@nestjs/swagger';
import { UserPreferencesDto } from './user-preferences.dto';

export class UserProfileResponseDto {
  @ApiProperty({ example: 'uuid', description: 'User ID' })
  id: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  email: string;

  @ApiProperty({ example: 'John', description: 'First name' })
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  lastName: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'Phone number',
    nullable: true,
  })
  phoneNumber: string;

  @ApiProperty({ example: true, description: 'Account active status' })
  isActive: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Last login timestamp',
    nullable: true,
  })
  lastLoginAt: Date | null;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Account creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;

  @ApiProperty({
    type: UserPreferencesDto,
    description: 'User preferences',
    nullable: true,
  })
  preferences?: UserPreferencesDto;

  @ApiProperty({
    example: 'USD',
    description: 'Preferred currency',
    default: 'USD',
  })
  preferredCurrency?: string;
}

export class UserStatsResponseDto {
  @ApiProperty({ example: 0, description: 'Total number of eSIM purchases' })
  totalPurchases: number;

  @ApiProperty({
    example: 0,
    description: 'Total amount spent (in preferred currency)',
  })
  totalSpent: number;

  @ApiProperty({
    example: 0,
    description: 'Number of active eSIM cards',
  })
  activeESims: number;

  @ApiProperty({
    example: 0,
    description: 'Number of countries visited',
  })
  countriesVisited: number;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Date of first purchase',
    nullable: true,
  })
  firstPurchaseAt: Date | null;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Date of last purchase',
    nullable: true,
  })
  lastPurchaseAt: Date | null;
}
