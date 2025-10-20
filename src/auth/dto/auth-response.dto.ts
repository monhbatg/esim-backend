import { Exclude, Expose } from 'class-transformer';

export class AuthResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  isActive: boolean;

  @Expose()
  lastLoginAt: Date;

  @Expose()
  createdAt: Date;

  @Expose()
  accessToken: string;

  @Expose()
  tokenType: string = 'Bearer';

  @Expose()
  expiresIn: number;
}
