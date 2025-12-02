import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
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
import { Customer } from 'src/entities/customer.entity';
import { Wallet } from 'src/entities/wallet.entity';

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
    private readonly logger = new Logger(UsersService.name);
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
    private readonly settingsRepo: Repository<SettingsReferences>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>
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
    rangedTranWithoutTax: number,
    rangedTranFureAmount: number
  }> {
    const { start, end } = getDateRange(timeRange);  
    const transactions = await this.esimPurchaseRepo.find({
    where: {
      createdAt: Between(start, end), // `Between` is a TypeORM helper to create BETWEEN query
    },
    order: {
      createdAt: 'DESC', // Orders by 'createdAt' in descending order
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

    const currencyValue = await this.referenceRepository.findOne({ where: { key: 'DollarCurrency' } });
    const qpayTaxPercent =await this.referenceRepository.findOne({ where: { key: 'QpayTax' } });
    let itemCounter = 0;
    const convertData = (data: any[]) => {
      return data.map(async item => {
        // Customer Info
        const customer =await this.getCustomerById(item.customerId);
        const customerPhone =  customer!.phoneNumber //customer?.phoneNumber;
        const customerMail =  customer!.email;

        // Convert transaction date string to Date object
        let transactionDate = item.createdAt; // Assuming item.createdAt is a Date object
        // Add 8 hours to the current date
        transactionDate.setHours(transactionDate.getHours() + 8);
        transactionDate = transactionDate.toISOString().replace('T', ' ').split('.')[0];
       
        // Convert price (USD) to supply amount and convert to MNT
        const supplyAmount = Number(item.price/10000); // Supply amount in USD for example (you can adjust this)
        const supplyAmountMNT = supplyAmount * Number(currencyValue?.value);;
      
        // Calculating buy amount (with and without tax) from the price
        const buyAmountWithTax = Number(item.invoiceAmount);
        const buyAmountWithoutTax = item.invoiceAmount*((100-Number(qpayTaxPercent?.value))/100); // Assuming no tax in this example
        const fureAmount = buyAmountWithoutTax - supplyAmountMNT;
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
          fureAmount
        };
      });
    };

    const convertedData = convertData(joinedData);
    const orderCount = joinedData.filter((transaction) => transaction!.iccid === null).length;
    const topupCount = joinedData.filter((transaction) => transaction!.iccid !== null).length;
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
    const resolvedData = await Promise.all(convertedData);
    const sumSupplyAmount = resolvedData.reduce((sum, item) => sum + Number(item.supplyAmount), 0);
    const sumSupplyAmountMNT = resolvedData.reduce((sum, item) => sum + item.supplyAmountMNT, 0);
    const tranWithoutTaxAmount = transactionAmount*((100-Number(qpayTaxPercent?.value))/100);
    const tranWithTaxAmount = transactionAmount;
    const totalFureAmount = resolvedData.reduce((sum, item) => sum + item.fureAmount, 0);



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
    rangedTranFureAmount: totalFureAmount
  };
  }
  
  async getCustomerById(customerId: string): Promise<Customer | null> {
  return await this.customerRepository.findOne({
    where: { id: customerId },
  });
}

  
  async calculateSalaryPre(): Promise<{
    rangedTranPriecUSD: number,
    rangedTranPriceMNT: number,
    rangedTranWithTax: number,
    rangedTranWithoutTax: number,
    rangedTranFureAmount: number
  }> {
  const { start, end } = getSalaryDate();  
  const transactions = await this.esimPurchaseRepo.find({
    where: {
      createdAt: Between(start, end), // `Between` is a TypeORM helper to create BETWEEN query
    },
    order: {
      createdAt: 'DESC', // Orders by 'createdAt' in descending order
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

    const currencyValue = await this.referenceRepository.findOne({ where: { key: 'DollarCurrency' } });
    const qpayTaxPercent = await this.referenceRepository.findOne({ where: { key: 'QpayTax' } });
    
    let itemCounter = 0;
    const convertData = (data: any[]) => {
      return data.map(async item => {
        // Customer Info
        const customer =await this.getCustomerById(item.customerId);
        const customerPhone =  customer!.phoneNumber //customer?.phoneNumber;
        const customerMail =  customer!.email;

        // Convert transaction date string to Date object
        let transactionDate = item.createdAt; // Assuming item.createdAt is a Date object
        // Add 8 hours to the current date
        transactionDate.setHours(transactionDate.getHours() + 8);
        transactionDate = transactionDate.toISOString().replace('T', ' ').split('.')[0];
       
        // Convert price (USD) to supply amount and convert to MNT
        const supplyAmount = Number(item.price/10000); // Supply amount in USD for example (you can adjust this)
        const supplyAmountMNT = supplyAmount * Number(currencyValue?.value);;
      
        // Calculating buy amount (with and without tax) from the price
        const buyAmountWithTax = Number(item.invoiceAmount);
        const buyAmountWithoutTax = item.invoiceAmount*((100-Number(qpayTaxPercent?.value))/100); // Assuming no tax in this example
        const fureAmount = buyAmountWithoutTax - supplyAmountMNT;
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
          fureAmount
        };
      });
    };
    const convertedData = convertData(joinedData);
    const transactionAmount = joinedData.reduce((sum, transaction) => sum + transaction!.invoiceAmount, 0);
    const resolvedData = await Promise.all(convertedData);
    const sumSupplyAmount = resolvedData.reduce((sum, item) => sum + Number(item.supplyAmount), 0);
    const sumSupplyAmountMNT = resolvedData.reduce((sum, item) => sum + item.supplyAmountMNT, 0);
    const tranWithoutTaxAmount = transactionAmount*((100-Number(qpayTaxPercent?.value))/100);
    const tranWithTaxAmount = transactionAmount;
    const totalFureAmount = resolvedData.reduce((sum, item) => sum + item.fureAmount, 0);
    return{
      rangedTranPriecUSD: sumSupplyAmount,
      rangedTranPriceMNT: sumSupplyAmountMNT,
      rangedTranWithTax: tranWithTaxAmount,
      rangedTranWithoutTax: tranWithoutTaxAmount,
      rangedTranFureAmount: totalFureAmount
    }


  }

  async calculateSalaryFinal(totalFureAmount: number, additionalExpenses: number): Promise<{
    totalFinalProfit: number;
    investmentTaxPercent: string;
    investmentTaxAmount: number;
    operatorsSalaryDetail: any[];
    totalOperatorSalary: number;
    developerSalaryDetail: any[];
    totalDeveloperSalary: number;
    totalAdminSalary: number;
  }> {
    totalFureAmount = totalFureAmount - additionalExpenses;
    const investmentPercent = await this.referenceRepository.findOne({ where: { key: 'InvestmentTax' } });
    const users: User[] = await this.getUsersByRole(UserRole.SUPPORT);
    const operatorIds = users.map((users) => users.id);
    const supportWallets = await this.walletRepository.find({where :{userId: In(operatorIds),},});
    const usersWalletDataSave = (data: any[]) => {
      return data.map(async item => {
        const supportId = item.userId;
        const supportUser = await this.userRepository.findOne({ where: { id: supportId } });
        const supportName = supportUser?.firstName;
        const supportWalletBalance = item.balance;
        return {
          operatorId: supportId,  // renamed for consistency with expected type
          operatorName: supportName,
          operatorSalary: supportWalletBalance,  // assuming `balance` represents salary
        };
      });
    };

    const userWallets = usersWalletDataSave(supportWallets);
    const approvedWallets = await Promise.all(userWallets);

    const totalOperatorsSalary = approvedWallets.reduce((sum, item) => sum + Number(item.operatorSalary),0);
    const investmenTax = totalFureAmount*(Number(investmentPercent?.value)/100);
    const fureProfit = totalFureAmount*((100-Number(investmentPercent?.value))/100);
    // minus Operators salary
    const minusOperatorSalary = fureProfit - totalOperatorsSalary;
    // calculate dev salary
    const devPercent1 = await this.referenceRepository.findOne({ where: { key: 'MainDeveloperSalary' } });
    const devPercent2 = await this.referenceRepository.findOne({ where: { key: 'SubDeveloperSalary' } });
    const dev1 = minusOperatorSalary*(Number(devPercent1?.value)/100);
    const dev2 = minusOperatorSalary*(Number(devPercent2?.value)/100);
    const totalDeveloperSalary = dev1 + dev2;
    const developerSalaryDetail = [
      {
        developer: 'MainDeveloper',
        salaryPercen: devPercent1?.value +'%',
        salary: dev1
      },
      {
        developer: 'SubDeveloper',
        salaryPercen: devPercent2?.value +'%',
        salary: dev2
      }
    ];
    // calculate admin salary
    const adminSalary = minusOperatorSalary - totalDeveloperSalary;
    return{
      totalFinalProfit: totalFureAmount,
      investmentTaxPercent: investmentPercent?.value + '%',
      investmentTaxAmount: investmenTax,
      operatorsSalaryDetail: approvedWallets,
      totalOperatorSalary: totalOperatorsSalary,
      developerSalaryDetail: developerSalaryDetail,
      totalDeveloperSalary: totalDeveloperSalary,
      totalAdminSalary: adminSalary
    }
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
        default:
          return {
            start: startOfDay,
            end: endOfDay,
          };
      }
}

function getSalaryDate(): {start: any; end: any;}{
  const today = new Date();
    // First day logic
    const firstDay = new Date(today);
    today.setDate(5);
    const lastDay = new Date(today);
    lastDay.setDate(today.getDate() - 1);
    lastDay.setHours(23, 59, 59, 999);
    //this.logger.log(`LastDay ===============>>>>>>>>${lastDay}`);
    //this.logger.log(`Today ===============>>>>>>>>${today}`);
    const dayOfMonth = today.getDate(); // Get the current day of the month

    if (dayOfMonth === 5) {
      firstDay.setMonth(today.getMonth() - 1);  // Go back to previous month
      firstDay.setDate(20); // Set the date to the 20th
    }
    else if (dayOfMonth === 20) {
      firstDay.setDate(5); // Set the date to the 1st
    }
    else {
      throw new BadRequestException('Invalid date: Must be the 5th or 20th.');
    }
    firstDay.setHours(0,0,0,0);
    //this.logger.log(`FirstDay ===============>>>>>>>>${firstDay}`);
    return {
      start:firstDay,
      end: lastDay
    };
  }
