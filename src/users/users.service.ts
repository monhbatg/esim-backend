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
import { EsimInvoice } from 'src/entities/esim-invoice.entity';
import { ESimPurchase } from 'src/entities/esim-purchase.entity';
import { Customer } from 'src/entities/customer.entity';
import { ConfigVariables } from 'src/entities/references.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ESimPurchase)
    private readonly esimPurchaseRepo: Repository<ESimPurchase>,
    @InjectRepository(EsimInvoice)
    private readonly esimInvoiceRepo: Repository<EsimInvoice>,
    @InjectRepository(ConfigVariables)
    private readonly referenceRepository: Repository<ConfigVariables>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
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
      rangedTranWithoutTax: number,
      rangedTranPureAmount: number
  }> {
      const { start, end } = getDateRange(timeRange);  //calculate Date
      const transactions = await this.esimPurchaseRepo.find({                         // Step 1: Find time range transactions
      where: {
        createdAt: Between(start, end), // `Between` is a TypeORM helper to create BETWEEN query
      },
      order: {
        createdAt: 'DESC', // Orders by 'createdAt' in descending order
      },
      });
      const invoiceIds = transactions.map((transaction) => transaction.invoiceId);    // Step 2: Extract invoiceIds from transactions 
      const invoices = await this.esimInvoiceRepo.find({                              // Step 3: Fetch invoices using the extracted invoiceIds
        where: {
          id: In(invoiceIds),  // Use the `In()` operator to fetch all invoices with matching ids
        },
      }); 
      const joinedData = transactions.map((transaction) => {                          // Step 1: Join the transactions and invoices by matching invoiceId to id
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
      const currencyValue = await this.referenceRepository.findOne({ where: { key: 'DollarCurrency' } });
      const qpayTaxPercent =await this.referenceRepository.findOne({ where: { key: 'QpayTax' } });
      let itemCounter = 0;
      //Build table(List) data
      const convertData = (data: any[]) => {
        return data.map(async item => {
          // Customer Info
          const customer =await this.getCustomerById(item.customerId);
          const customerPhone =  customer!.phoneNumber //customer?.phoneNumber;
          const customerMail =  customer!.email;  
          // Convert transaction date string to Date object
          let transactionDate = item.createdAt;                                       // Assuming item.createdAt is a Date object
          transactionDate.setHours(transactionDate.getHours() + 8);                   // Add 8 hours to the current date Ulaanbaatar
          transactionDate = transactionDate.toISOString().replace('T', ' ').split('.')[0];
      
          // Convert price (USD) to supply amount and convert to MNT
          const supplyAmount = Number(item.price/10000); // Supply amount in USD for example (you can adjust this)
          const supplyAmountMNT = supplyAmount * Number(currencyValue?.value); // USD to MNT 
      
          // Calculating buy amount (with and without tax) from the price
          const buyAmountWithTax = Number(item.invoiceAmount);
          const buyAmountWithoutTax = item.invoiceAmount*((100-Number(qpayTaxPercent?.value))/100); // Assuming no tax in this example
          const pureAmount = buyAmountWithoutTax - supplyAmountMNT;
          itemCounter++;
          // Return the new object
          return {
            itemCounter,
            transactionDate,
            packageName: item.packageName,
            transactionType: item.iccid === null ? "Захиалга" : "Цэнэглэлт", // Assuming 'Order' when ICCID is null
            customerPhone,
            customerMail,
            supplyAmount,
            supplyAmountMNT,
            buyAmountWithTax,
            buyAmountWithoutTax,
            pureAmount
          };
        });
      };  
      const convertedData = convertData(joinedData);
      const orderCount = joinedData.filter((transaction) => transaction!.iccid === null).length;
      const topupCount = joinedData.filter((transaction) => transaction!.iccid !== null).length;
      const transactionAmount = joinedData.reduce((sum, transaction) => sum + transaction!.invoiceAmount, 0);
      const orderAmount = joinedData.reduce((sum, transaction) => {  // Нийт захиалга хийсэн дүн
        if (transaction!.iccid === null) {
          return sum + Number(transaction!.invoiceAmount);
        }
        return sum;
      }, 0);
      const topupAmount = joinedData.reduce((sum, transaction) => {   // Нийт цэнэглэсэн дүн
        if (transaction!.iccid !== null) {
          return sum + Number(transaction!.invoiceAmount);
        }
        return sum;
      }, 0);
      const resolvedData = await Promise.all(convertedData);
      const sumSupplyAmount = resolvedData.reduce((sum, item) => sum + Number(item.supplyAmount), 0);        // Нийлүүлэгчээс нийт авсан дүн USD
      const sumSupplyAmountMNT = resolvedData.reduce((sum, item) => sum + item.supplyAmountMNT, 0);          // Нийлүүлэгчээс нийт авсан дүн MNT
      const tranWithTaxAmount = transactionAmount;                                                           // Нийт орлого дүн
      const tranWithoutTaxAmount = transactionAmount*((100-Number(qpayTaxPercent?.value))/100);              // Нийт орлогоос QPay шимтгэл хассан дүн        
      const totalPureAmount = resolvedData.reduce((sum, item) => sum + item.pureAmount, 0);                  // Нийт цэвэр орлого (Нийт орлого - Нийлүүлэгчээс нийт авсан дүн)
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
          rangedTransactions: resolvedData,
          rangedTransactionCount: convertedData.length,
          rangedTranPriecUSD: Number(sumSupplyAmount.toFixed(2)),
          rangedTranPriceMNT: sumSupplyAmountMNT,
          rangedTranWithTax: tranWithTaxAmount,
          rangedTranWithoutTax: tranWithoutTaxAmount,
          rangedTranPureAmount: totalPureAmount
      };
  }

  async getCustomerById(customerId: string): Promise<Customer | null> {
        return await this.customerRepository.findOne({
          where: { id: customerId },
        });
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
        case 'last_week':
          const lastDayOfWeek = new Date(now);
          //firstDayOfWeek.setDate(now.getDate() - now.getDay()); // Start of this week (Sunday or Monday depending on locale)
          const firstDayOfWeek = new Date(lastDayOfWeek);
          firstDayOfWeek.setDate(lastDayOfWeek.getDate() - 6); // End of this week (Saturday)
        
          return {
            start: new Date(firstDayOfWeek.setHours(0, 0, 0, 0)),  // Start of the week
            end: new Date(lastDayOfWeek.setHours(23, 59, 59, 999)),  // End of the week
          };
        case 'last_two_week':
          const lastDayOfTwoWeek = new Date(now);
          //firstDayOfWeek.setDate(now.getDate() - now.getDay()); // Start of this week (Sunday or Monday depending on locale)
          const firstDayOfTwoWeek = new Date(lastDayOfTwoWeek);
          firstDayOfTwoWeek.setDate(lastDayOfTwoWeek.getDate() - 13); // End of this week (Saturday)
        
          return {
            start: new Date(firstDayOfTwoWeek.setHours(0, 0, 0, 0)),  // Start of the 2 week
            end: new Date(lastDayOfTwoWeek.setHours(23, 59, 59, 999)),  // End of the 2 week
          };
        case 'last_month':
          const lastDayOfMonth = new Date(now);
          //firstDayOfWeek.setDate(now.getDate() - now.getDay()); // Start of this week (Sunday or Monday depending on locale)
          const firstDayOfMonth = new Date(lastDayOfMonth);
          firstDayOfMonth.setMonth(lastDayOfMonth.getMonth() - 1); // End of this week (Saturday)
        
          return {
            start: new Date(firstDayOfMonth.setHours(0, 0, 0, 0)),  // Start of the 2 week
            end: new Date(lastDayOfMonth.setHours(23, 59, 59, 999)),  // End of the 2 week
          };
        default:
          return {
            start: startOfDay,
            end: endOfDay,
          };
    }
}