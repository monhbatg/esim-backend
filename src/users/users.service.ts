import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { SignUpDto } from '../auth/dto/signup.dto';
import { UpdateUserPreferencesDto } from './dto/user-preferences.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UserStatsResponseDto } from './dto/user-response.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UserRole } from './dto/user-role.enum';
import { ReferencesHistory } from 'src/entities/reference-history.entity';
import { SettingsReferences } from 'src/entities/settings-references.entity';
import { ReferenceReq, UpdateRefs } from './dto/reference-request.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SettingsReferences)
    private readonly referenceRepository: Repository<SettingsReferences>,
    @InjectRepository(ReferencesHistory)
    private readonly refHistoryRepo: Repository<ReferencesHistory>,
  ) {}

  async create(createUserDto: SignUpDto): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create new user
    const user = this.userRepository.create(createUserDto);
    return await this.userRepository.save(user);
  }

  async findByEmail(
    email: string,
    includePassword = false,
  ): Promise<User | null> {
    if (includePassword) {
      return await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.password')
        .where('user.email = :email', { email })
        .getOne();
    }
    return await this.userRepository.findOne({
      where: { email },
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async upsertFromGoogleProfile(profile: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<User> {
    const existingByGoogle = await this.userRepository.findOne({
      where: { googleId: profile.googleId },
    });

    if (existingByGoogle) {
      return existingByGoogle;
    }

    const existingByEmail = await this.userRepository.findOne({
      where: { email: profile.email },
    });

    if (existingByEmail) {
      existingByEmail.googleId = profile.googleId;
      if (!existingByEmail.firstName)
        existingByEmail.firstName = profile.firstName;
      if (!existingByEmail.lastName)
        existingByEmail.lastName = profile.lastName;
      return await this.userRepository.save(existingByEmail);
    }

    const user = this.userRepository.create({
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      password: null,
      googleId: profile.googleId,
    } as Partial<User>);

    return await this.userRepository.save(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, {
      lastLoginAt: new Date(),
    });
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User> {
    const user = await this.findById(id);

    // Remove password from update data if present
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...safeUpdateData } = updateData;

    Object.assign(user, safeUpdateData);
    return await this.userRepository.save(user);
  }

  async deactivateUser(id: string): Promise<void> {
    await this.userRepository.update(id, {
      isActive: false,
    });
  }

  async activateUser(id: string): Promise<void> {
    await this.userRepository.update(id, {
      isActive: true,
    });
  }

  async updatePreferences(
    id: string,
    preferences: UpdateUserPreferencesDto,
  ): Promise<User> {
    const user = await this.findById(id);

    if (preferences.preferredCurrency) {
      user.preferredCurrency = preferences.preferredCurrency;
    }
    if (preferences.preferredLanguage) {
      user.preferredLanguage = preferences.preferredLanguage;
    }
    if (preferences.emailNotifications !== undefined) {
      user.emailNotifications = preferences.emailNotifications;
    }
    if (preferences.smsNotifications !== undefined) {
      user.smsNotifications = preferences.smsNotifications;
    }
    if (preferences.pushNotifications !== undefined) {
      user.pushNotifications = preferences.pushNotifications;
    }
    if (preferences.favoriteCountries !== undefined) {
      user.favoriteCountries = preferences.favoriteCountries;
    }
    if (preferences.timezone) {
      user.timezone = preferences.timezone;
    }

    return await this.userRepository.save(user);
  }

  async getPreferences(id: string): Promise<Partial<User>> {
    const user = await this.findById(id);
    return {
      preferredCurrency: user.preferredCurrency,
      preferredLanguage: user.preferredLanguage,
      emailNotifications: user.emailNotifications,
      smsNotifications: user.smsNotifications,
      pushNotifications: user.pushNotifications,
      favoriteCountries: user.favoriteCountries,
      timezone: user.timezone,
    };
  }

  async changePassword(
    id: string,
    passwordDto: UpdatePasswordDto,
  ): Promise<void> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException(
        'Password change not available for accounts without a password',
      );
    }

    const isCurrentPasswordValid = await user.validatePassword(
      passwordDto.currentPassword,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Update password (will be hashed by BeforeUpdate hook)
    user.password = passwordDto.newPassword;
    await this.userRepository.save(user);
  }

  async getUserStats(id: string): Promise<UserStatsResponseDto> {
    const user = await this.findById(id);

    // TODO: Replace with actual queries when orders/purchases tables are implemented
    // For now, return placeholder stats
    return {
      totalPurchases: 0,
      totalSpent: 0,
      activeESims: 0,
      countriesVisited: user.favoriteCountries?.length || 0,
      firstPurchaseAt: null,
      lastPurchaseAt: null,
    };
  }

  async getProfile(id: string): Promise<User> {
    return await this.findById(id);
  }

  async deleteAccount(id: string): Promise<void> {
    // Verify user exists
    await this.findById(id);
    // Soft delete by deactivating
    await this.deactivateUser(id);
    // Optionally, you could also delete the user record:
    // const user = await this.findById(id);
    // await this.userRepository.remove(user);
  }

  async updateRole(
    userId: string,
    updateRoleDto: UpdateRoleDto,
  ): Promise<User> {
    const user = await this.findById(userId);
    user.role = updateRoleDto.role;
    return await this.userRepository.save(user);
  }

  async getAllUsers(): Promise<User[]> {
    return await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    return await this.userRepository.find({
      where: { role },
      order: { createdAt: 'DESC' },
    });
  }

  async setReferences(id: string, body: ReferenceReq): Promise<any>{
    const existConf = await this.referenceRepository.findOne({where: {key: body.key}});
    if(existConf ){
      if(existConf.value!=body.value){
      const historyRef = this.refHistoryRepo.create({
        referenceId: existConf.id,
        module: body.module,
        key: body.key,
        type: body.type,
        oldValue: existConf.value,
        newValue: body.value,
        changedBy: id
      });
      historyRef.changedAt = new Date();
      await this.refHistoryRepo.save(historyRef);
      await this.referenceRepository.update({ 
        key: existConf.key },
        {
         value: body.value,
         updatedAt: new Date()
        },);
      const writedRes = await  this.referenceRepository.findOne({where: {key: body.key}});
    return writedRes;
      }else{
        throw new BadRequestException('Already exists');
      }
    }else{
      const refReport = this.referenceRepository.create({
      module: body.module,
      key: body.key,
      type: body.type,
      value: body.value,
      description: body.description,
      userId: id
    });
    refReport.createdAt = new Date();
    refReport.updatedAt = new Date();

    await this.referenceRepository.save(refReport);
    }
  }
    
  async getReferences(): Promise<any>{
    const references = await this.referenceRepository.find({
      order: {
        module: 'DESC', // Orders by 'createdAt' in descending order
      },});
    return references;
  }

  async updateReferences(id: string, body: UpdateRefs): Promise<any> {
    const existConf = await this.referenceRepository.findOne({where: {id: body.id, userId: id}});
    if(existConf){
      existConf!.value= body.value;
      await this.referenceRepository.update(existConf!.id,existConf!);
    }else{
      throw new BadRequestException('Та засах эрхгүй байна');
    }
    const response = {
      statusCode: 200,
      data: await this.getReferences(),
      message: "Амжилттай",
      error: "",
      success:true
    }    
    return response;
  }
}