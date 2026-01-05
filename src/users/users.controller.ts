import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthRequest } from '../auth/interfaces/auth-request.interface';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import {
  UpdateUserPreferencesDto,
  UserPreferencesDto,
} from './dto/user-preferences.dto';
import {
  UserProfileResponseDto,
  UserStatsResponseDto,
} from './dto/user-response.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UserRole } from './dto/user-role.enum';
import { User } from '../entities/user.entity';
import type { ReferenceReq, UpdateRefs } from './dto/reference-request.dto';
import { AdminService } from './admin.service';
import type { SalaryReq } from './dto/salary-req.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly adminService: AdminService
) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Retrieve the authenticated user profile with preferences',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: UserProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getProfile(
    @Request() req: AuthRequest,
  ): Promise<UserProfileResponseDto> {
    const user = await this.usersService.getProfile(req.user.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...profile } = user;
    return profile as UserProfileResponseDto;
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile (alias)',
    description: 'Alias for GET /users/profile',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: UserProfileResponseDto,
  })
  async getMe(@Request() req: AuthRequest): Promise<UserProfileResponseDto> {
    return this.getProfile(req);
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user profile',
    description:
      'Update user profile information (firstName, lastName, phoneNumber)',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserProfileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async updateProfile(
    @Request() req: AuthRequest,
    @Body(ValidationPipe) updateProfileDto: UpdateProfileDto,
  ): Promise<UserProfileResponseDto> {
    const user = await this.usersService.updateUser(
      req.user.id,
      updateProfileDto,
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...profile } = user;
    return profile as UserProfileResponseDto;
  }

  @Put('password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change user password',
    description: 'Update user password with current password verification',
  })
  @ApiBody({ type: UpdatePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Password changed successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or password change not available',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid current password or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async changePassword(
    @Request() req: AuthRequest,
    @Body(ValidationPipe) updatePasswordDto: UpdatePasswordDto,
  ): Promise<{ message: string }> {
    await this.usersService.changePassword(req.user.id, updatePasswordDto);
    return { message: 'Password changed successfully' };
  }

  @Get('preferences')
  @ApiOperation({
    summary: 'Get user preferences',
    description:
      'Retrieve user preferences (currency, language, notifications, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'User preferences retrieved successfully',
    type: UserPreferencesDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getPreferences(
    @Request() req: AuthRequest,
  ): Promise<UserPreferencesDto> {
    return (await this.usersService.getPreferences(
      req.user.id,
    )) as UserPreferencesDto;
  }

  @Put('preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user preferences',
    description:
      'Update user preferences including currency, language, notifications, and favorite countries',
  })
  @ApiBody({ type: UpdateUserPreferencesDto })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated successfully',
    type: UserPreferencesDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async updatePreferences(
    @Request() req: AuthRequest,
    @Body(ValidationPipe) updatePreferencesDto: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesDto> {
    const user = await this.usersService.updatePreferences(
      req.user.id,
      updatePreferencesDto,
    );
    return (await this.usersService.getPreferences(
      user.id,
    )) as UserPreferencesDto;
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get user statistics',
    description:
      'Retrieve user statistics including purchase history, spending, and activity',
  })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
    type: UserStatsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getStats(@Request() req: AuthRequest): Promise<UserStatsResponseDto> {
    return await this.usersService.getUserStats(req.user.id);
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete user account',
    description: 'Deactivate and delete user account (soft delete)',
  })
  @ApiResponse({
    status: 200,
    description: 'Account deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Account deleted successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async deleteAccount(
    @Request() req: AuthRequest,
  ): Promise<{ message: string }> {
    await this.usersService.deleteAccount(req.user.id);
    return { message: 'Account deleted successfully' };
  }

  // Admin-only endpoints
  @Patch('admin/:userId/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user role (Admin only)',
    description: 'Change a user role. Only admins can perform this action.',
  })
  @ApiBody({ type: UpdateRoleDto })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
    type: UserProfileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async updateUserRole(
    @Param('userId') userId: string,
    @Body(ValidationPipe) updateRoleDto: UpdateRoleDto,
  ): Promise<UserProfileResponseDto> {
    const user: User = await this.usersService.updateRole(
      userId,
      updateRoleDto,
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...profile } = user;
    return profile as UserProfileResponseDto;
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all users (Admin only)',
    description: 'Retrieve a list of all users. Only admins can access this.',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: UserRole,
    description: 'Filter users by role',
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: [UserProfileResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getAllUsers(
    @Query('role') role?: UserRole,
  ): Promise<UserProfileResponseDto[]> {
    const users: User[] = role
      ? await this.usersService.getUsersByRole(role)
      : await this.usersService.getAllUsers();

    return users.map((user: User) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...profile } = user;
      return profile as UserProfileResponseDto;
    });
  }

  @Get('admin/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Get user by ID (Admin/Support only)',
    description:
      'Retrieve a specific user profile by ID. Admins and support staff can access this.',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: UserProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or Support access required',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserById(
    @Param('userId') userId: string,
  ): Promise<UserProfileResponseDto> {
    const user = await this.usersService.findById(userId);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...profile } = user;
    return profile as UserProfileResponseDto;
  }

  @Post('set/reference')
  @ApiOperation({
    summary: 'Set configuration parametrs',
    description: 'Set configuration parametrs',
  })
  @ApiResponse({
    status: 200,
    description: 'User preferences retrieved successfully',
    type: UserPreferencesDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async setReferences(
    @Request() req: AuthRequest,
    @Body() body: ReferenceReq,
  ): Promise<any> {
    if(req.user.role === 'ADMIN')
      return (await this.adminService.setReferences(
        req.user.id, body
      ));
    else
      throw new ForbiddenException;
  }

  @Get('getReference')
  @ApiOperation({
    summary: 'Set configuration parametrs',
    description: 'Set configuration parametrs',
  })
  @ApiResponse({
    status: 200,
    description: 'User preferences retrieved successfully',
    type: UserPreferencesDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getReferences(
    @Request() req: AuthRequest,
  ): Promise<any> {
    if(req.user.role === 'ADMIN')
      return (await this.adminService.getReferences());
    else
      throw new ForbiddenException;
  }

  @Post('update/reference')
  @ApiOperation({
    summary: 'Set configuration parametrs',
    description: 'Set configuration parametrs',
  })
  @ApiResponse({
    status: 200,
    description: 'User preferences retrieved successfully',
    type: UserPreferencesDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async updateReferences(
    @Request() req: AuthRequest,
    @Body() body: UpdateRefs,
  ): Promise<any> {
    return (await this.adminService.updateReferences(
      req.user.id, body
    ));
  }

  @Get('getDashboard/:timeRange')
  @ApiOperation({
    summary: 'Get dashboard infos',
    description: 'Get dashboard infos, onboarding, monitoring',
  })
  @ApiResponse({
    status: 200,
    description: 'User request successfully',
    type: UserPreferencesDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getDashboard(
    @Request() req: AuthRequest,
    @Param('timeRange') timeRange: string,
  ): Promise<any> {
    if(req.user.role === 'ADMIN')
      return (await this.adminService.getOnboard(timeRange));
    else
      throw new ForbiddenException;
  }

  @Get('calculateSalaryPre')
  @ApiOperation({
    summary: 'Get dashboard infos',
    description: 'Get dashboard infos, onboarding, monitoring',
  })
  @ApiResponse({
    status: 200,
    description: 'User request successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async calculateSalaryPre(
    @Request() req: AuthRequest,
  ): Promise<any> {
    if(req.user.role === 'ADMIN')
      return (await this.adminService.calculateSalaryPre());
    else
      throw new ForbiddenException;
  }

  @Post('calculateSalaryFinal')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get dashboard infos',
    description: 'Get dashboard infos, onboarding, monitoring',
  })
  @ApiResponse({
    status: 200,
    description: 'User request successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async calculateSalaryFinal(
    @Request() req: AuthRequest,
    @Body() body: SalaryReq
  ): Promise<any> {
    if(req.user.role === 'ADMIN')
      return (await this.adminService.calculateSalaryFinal(body));
    else
      throw new ForbiddenException;
  }
}