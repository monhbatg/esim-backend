import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { SignUpDto } from '../auth/dto/signup.dto';
import { UpdateUserPreferencesDto } from './dto/user-preferences.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UserStatsResponseDto } from './dto/user-response.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UserRole } from './dto/user-role.enum';
import { SettingsReferences } from 'src/entities/references.entity';
import { ReferencesHistory } from 'src/entities/reference-history.entity';
import { ReferenceReq } from './dto/reference-request.dto';
import { Transaction } from 'src/entities/transaction.entity';
import { ESimPurchase } from 'src/entities/esim-purchase.entity';
import { EsimInvoice } from 'src/entities/esim-invoice.entity';

export interface transactionInfo{
  transactionDate: Date;
  packageName: any;
  transactionType: string;
  supplyAmount: number;
  supplyAmountMNT: number;
  buyAmountWithTax: number;
  buyAmountWithoutTax: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SettingsReferences)
    private readonly referenceRepository: Repository<SettingsReferences>,
    @InjectRepository(ReferencesHistory)
    private readonly refHistoryRepo: Repository<ReferencesHistory>,
    @InjectRepository(ESimPurchase)
    private readonly esimPurchaseRepo: Repository<ESimPurchase>,
    @InjectRepository(EsimInvoice)
    private readonly esimInvoiceRepo: Repository<EsimInvoice>,
    @InjectRepository(SettingsReferences)
    private readonly settingsRepo: Repository<SettingsReferences>
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
    const references = await this.referenceRepository.find({});
    return references;
  }

  async getOnboard(timeRange: string): Promise<{
    totalOrders: {
      amount: number;
      count: number;
    };
    baseOrders: {
      amount: number;
      count: number;
    };
    topUpOrders: {
      amount: number;
      count: number;
    };
    rangedTransactions:
      any[],
    rangedTransactionCount: number,
    rangedTranPriecUSD: number,
    rangedTranPriceMNT: number,
    rangedTranWithTax: number,
    rangedTranWithoutTax: number
    
  }> {
    const { start, end } = getDateRange(timeRange);  
    const transactions = await this.esimPurchaseRepo.find({
    where: {
      createdAt: Between(start, end) // `Between` is a TypeORM helper to create BETWEEN query
    },
    });
    // Step 2: Extract invoiceIds from transactions
    const invoiceIds = transactions.map((transaction) => transaction.invoiceId);

    // Step 3: Fetch invoices using the extracted invoiceIds
    const invoices = await this.esimInvoiceRepo.find({
      where: {
        id: In(invoiceIds),  // Use the `In()` operator to fetch all invoices with matching ids
      },
    });

    // Step 1: Join the transactions and invoices by matching invoiceId to id
    const joinedData = transactions.map((transaction) => {
      const invoice = invoices.find(invoice => invoice.id === transaction.invoiceId);
    
      // Step 2: If invoice is found, merge the transaction with the invoice details
      if (invoice) {
        return {
          ...transaction,
          invoiceAmount: invoice.amount,  // Add invoice amount to transaction
          invoiceCreatedAt: invoice.createdAt,  // Add invoice creation date to transaction
        };
      }
    });

    let currencyValue = 0;
    let qpayTaxPercent = 0;
    this.referenceRepository.findOne({ where: { key: 'DollarCurrency' } })
    .then(currencyRef => {
      if (currencyRef) {
        const currencyValue = Number(currencyRef.value);
        console.log(currencyValue); // Output the '3650' value
      }
    })
    this.referenceRepository.findOne({ where: { key: 'InvestmentTax' } })
    .then(qpayTexRef => {
      if (qpayTexRef) {
        qpayTaxPercent = Number(qpayTexRef.value);
        console.log(currencyValue); // Output the '3650' value
      }
    })
    const USD_TO_MNT = currencyValue;
    const convertData = (data: any[]) => {
      return data.map(item => {
        // Convert transaction date string to Date object
        const transactionDate = new Date(item.createdAt);
      
        // Convert price (USD) to supply amount and convert to MNT
        const supplyAmount = Number(item.price/10000); // Supply amount in USD for example (you can adjust this)
        const supplyAmountMNT = supplyAmount * USD_TO_MNT;
      
        // Calculating buy amount (with and without tax) from the price
        const buyAmountWithTax = Number(item.invoiceAmount);
        const buyAmountWithoutTax = item.invoiceAmount*((100-qpayTaxPercent)/100); // Assuming no tax in this example
      
        // Return the new object
        return {
          transactionDate,
          packageName: item.packageName,
          transactionType: item.iccid === null ? "Захиалга" : "Цэнэглэлт", // Assuming 'Order' when ICCID is null
          supplyAmount,
          supplyAmountMNT,
          buyAmountWithTax,
          buyAmountWithoutTax,
        };
      });
    };

    const convertedData = convertData(joinedData);

    const orderCount = joinedData.filter((transaction) => transaction!.iccid === null).length;
    const topupCount = joinedData.filter((transaction) => transaction!.iccid !== null).length;
    //const transactionAmount = 0;
    const transactionAmount = joinedData.reduce((sum, transaction) => sum + transaction!.invoiceAmount, 0);
    const orderAmount = joinedData.reduce((sum, transaction) => {
      if (transaction!.iccid === null) {
        return sum + Number(transaction!.invoiceAmount);
      }
      return sum;
    }, 0);
    const topupAmount = joinedData.reduce((sum, transaction) => {
      if (transaction!.iccid !== null) {
        return sum + Number(transaction!.invoiceAmount);
      }
      return sum;
    }, 0);
    const sumSupplyAmount = convertedData.reduce((sum, item) => sum + Number(item.supplyAmount), 0);
    const sumSupplyAmountMNT = convertedData.reduce((sum, item) => sum + item.supplyAmountMNT, 0);
    const tranWithoutTaxAmount = transactionAmount;
    const tranWithTaxAmount = transactionAmount*((100-qpayTaxPercent)/100);

console.log(sumSupplyAmountMNT);


  return {
    totalOrders: {
      amount: transactionAmount,
      count: transactions.length,
    },
    baseOrders: {
      amount: orderAmount,
      count: orderCount,
    },
    topUpOrders: {
      amount: topupAmount,
      count: topupCount,
    },
    rangedTransactions: convertedData,
    rangedTransactionCount: convertedData.length,
    rangedTranPriecUSD: Number(sumSupplyAmount.toFixed(2)),
    rangedTranPriceMNT: sumSupplyAmountMNT,
    rangedTranWithTax: tranWithTaxAmount,
    rangedTranWithoutTax: tranWithoutTaxAmount
  };
  }
}
function getDateRange(timeRange: string): { start: any; end: any; } {
  const now = new Date();  // Create a new Date object representing the current date and time
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));  // Start of the day (00:00:00)
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));  // End of the day (23:59:59)
  switch (timeRange) {
        case 'today':
          return {
            start: startOfDay,
            end: endOfDay,
          };
        case 'yesterday':
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);  // Subtract 1 day to get yesterday
          return {
            start: new Date(yesterday.setHours(0, 0, 0, 0)),  // Start of yesterday
            end: new Date(yesterday.setHours(23, 59, 59, 999)), // End of yesterday
          };
        case 'this_week':
          const firstDayOfWeek = new Date(now);
          firstDayOfWeek.setDate(now.getDate() - now.getDay()); // Start of this week (Sunday or Monday depending on locale)
          const lastDayOfWeek = new Date(firstDayOfWeek);
          lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6); // End of this week (Saturday)
        
          return {
            start: new Date(firstDayOfWeek.setHours(0, 0, 0, 0)),  // Start of the week
            end: new Date(lastDayOfWeek.setHours(23, 59, 59, 999)),  // End of the week
          };
        default:
          return {
            start: startOfDay,
            end: endOfDay,
          };
      }
}