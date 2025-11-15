import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserPreferencesDto {
  @ApiPropertyOptional({
    example: 'USD',
    description: 'Preferred currency code (ISO 4217)',
    enum: [
      'USD',
      'EUR',
      'GBP',
      'JPY',
      'CNY',
      'AUD',
      'CAD',
      'CHF',
      'INR',
      'SGD',
    ],
  })
  @IsOptional()
  @IsString()
  @IsIn(
    ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'INR', 'SGD'],
    {
      message: 'Invalid currency code',
    },
  )
  preferredCurrency?: string;

  @ApiPropertyOptional({
    example: 'en',
    description: 'Preferred language code (ISO 639-1)',
    enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ko', 'ar'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ko', 'ar'], {
    message: 'Invalid language code',
  })
  preferredLanguage?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable email notifications for promotions',
  })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable SMS notifications for order updates',
  })
  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable push notifications',
  })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiPropertyOptional({
    example: ['US', 'GB', 'FR'],
    description: 'Array of favorite country codes for quick access',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  favoriteCountries?: string[];

  @ApiPropertyOptional({
    example: 'UTC',
    description: 'User timezone',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Timezone must not exceed 50 characters' })
  timezone?: string;
}

export class UserPreferencesDto {
  preferredCurrency: string;
  preferredLanguage: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  favoriteCountries: string[];
  timezone: string;
}
