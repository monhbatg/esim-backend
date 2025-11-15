import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from './user-role.enum';

export class UpdateRoleDto {
  @ApiProperty({
    enum: UserRole,
    example: UserRole.ADMIN,
    description: 'New role to assign to the user',
  })
  @IsEnum(UserRole, {
    message: 'Role must be one of: USER, ADMIN, SUPPORT',
  })
  role: UserRole;
}
