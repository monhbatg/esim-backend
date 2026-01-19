import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Customer } from "../entities/customer.entity";
import { EsimInvoice } from "../entities/esim-invoice.entity";
import { ESimPurchase } from "../entities/esim-purchase.entity";
import { ReferencesHistory } from "../entities/reference-history.entity";
import { Salary } from "../entities/salary.entity";
import { User } from "../entities/user.entity";
import { Wallet } from "../entities/wallet.entity";
import { Repository, Between, In } from "typeorm";
import { ReferenceReq, UpdateRefs } from "./dto/reference-request.dto";
import { SalaryReq } from "./dto/salary-req.dto";
import { UserRole } from "./dto/user-role.enum";
import { ConfigVariables } from "src/entities/references.entity";

export interface SalaryData{
    totalFinalProfit: number;
    investmentTaxPercent: string;
    investmentTaxAmount: number;
    operatorsSalaryDetail: any[];
    totalOperatorSalary: number;
    developerSalaryDetail: any[];
    totalDeveloperSalary: number;
    totalAdminSalary: number;
    title: string;
    startDate: string;
    endDate: string
}



@Injectable()
export class AdminService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(ConfigVariables)
        private readonly referenceRepository: Repository<ConfigVariables>,
        @InjectRepository(ReferencesHistory)
        private readonly refHistoryRepo: Repository<ReferencesHistory>,
        @InjectRepository(ESimPurchase)
        private readonly esimPurchaseRepo: Repository<ESimPurchase>,
        @InjectRepository(EsimInvoice)
        private readonly esimInvoiceRepo: Repository<EsimInvoice>,
        @InjectRepository(Customer)
        private readonly customerRepository: Repository<Customer>,
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>,
        @InjectRepository(Salary)
        private readonly SalaryRepository: Repository<Salary>
      ) {}

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
            //transactionDate.setHours(transactionDate.getHours() + 8);                   // Add 8 hours to the current date Ulaanbaatar
            transactionDate = transactionDate.toISOString().replace('T', ' ').split('.')[0];
        
            // Convert price (USD) to supply amount and convert to MNT
            const supplyAmount = Number(item.price/10000); // Supply amount in USD for example (you can adjust this)
            const supplyAmountMNT = Math.round( Number(supplyAmount) * Number(currencyValue?.value)); // USD to MNT 
        
            // Calculating buy amount (with and without tax) from the price
            const buyAmountWithTax = Number(item.invoiceAmount);
            const buyAmountWithoutTax = item.invoiceAmount*((100-Number(qpayTaxPercent?.value))/100); // Assuming no tax in this example
            const pureAmount = Number(buyAmountWithoutTax - supplyAmountMNT);
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
    
      
    async calculateSalaryPre(): Promise<{
        rangedTranPriecUSD: number,
        rangedTranPriceMNT: number,
        rangedTranWithTax: number,
        rangedTranWithoutTax: number,
        rangedTranPureAmount: number,
        startDate: Date,
        endDate: Date
        title: string
    }> {
        const { start, end, title } = getSalaryDate(); 
        // Step 1: Нийт start -> end хугацааны хоорон дахь гүйлгээг олно 
        const transactions = await this.esimPurchaseRepo.find({
            where: {
            createdAt: Between(start, end), // `Between` is a TypeORM helper to create BETWEEN query
            },
            order: {
            createdAt: 'DESC', // Orders by 'createdAt' in descending order
            },
        });
        // Step 2: esim_invoice  дээрь id -нуудыг олно
        const invoiceIds = transactions.map((transaction) => transaction.invoiceId);
    
        // Step 3: Тухайн id тай бичилтүүдийг авна
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

        // Тоон үзүүлэлтүүдийг бодох хэсэг
        const convertedData = convertData(joinedData);
        const resolvedData = await Promise.all(convertedData);
        const transactionAmount = joinedData.reduce((sum, transaction) => sum + transaction!.invoiceAmount, 0); // Нийт орлого
        const sumSupplyAmount = resolvedData.reduce((sum, item) => sum + Number(item.supplyAmount), 0);         // Нийт нийлүүлэгчийн дүн USD
        const sumSupplyAmountMNT = resolvedData.reduce((sum, item) => sum + item.supplyAmountMNT, 0);           // Нийт нийлүүлэгчийн дүн MNT
        const tranWithTaxAmount = transactionAmount;                                                            // Нийт орлого дүн
        const tranWithoutTaxAmount = transactionAmount*((100-Number(qpayTaxPercent?.value))/100);               // Нийт орлогоос QPay шимтгэл хассан дүн 
        const totalPureAmount = resolvedData.reduce((sum, item) => sum + item.pureAmount, 0);                   // Нийт цэвэр орлого (Нийт орлого - Нийлүүлэгчээс нийт авсан дүн)
        start.setHours(start.getHours() + 8);
        const startDate = start.toISOString().replace('T', ' ').split('.')[0];                                  // Бодолт хийсэн ЭХЛЭХ ХУГАЦАА
        end.setHours(end.getHours() + 8);
        const endDate = end.toISOString().replace('T', ' ').split('.')[0];                                      // Бодолт хийсэн ДУУСАХ ХУГАЦАА
        return{
          rangedTranPriecUSD: Number(sumSupplyAmount.toFixed(2)),
          rangedTranPriceMNT: sumSupplyAmountMNT,
          rangedTranWithTax: tranWithTaxAmount,
          rangedTranWithoutTax: tranWithoutTaxAmount,
          rangedTranPureAmount: totalPureAmount,
          startDate: startDate,
          endDate: endDate,
          title: title
        }
    
    
      }
    
    async calculateSalaryFinal(body: SalaryReq): Promise<{
      totalFinalProfit: number;
      investmentTaxPercent: string;
      investmentTaxAmount: number;
      operatorsSalaryDetail: any[];
      totalOperatorSalary: number;
      developerSalaryDetail: any[];
      totalDeveloperSalary: number;
      totalAdminSalary: number;
      title: string;
      startDate: string;
      endDate: string
    }> {
        const { start, end, title } = getSalaryDate(); 
        const salaryExist = await this.SalaryRepository.findOne({ where: {startDate: start}})
        if(salaryExist){
            if(salaryExist.runningCosts === body.loss){
                return{
                    totalFinalProfit: salaryExist.totalFinalProfit,
                    investmentTaxPercent: salaryExist.investmentTaxPercent,
                    investmentTaxAmount: salaryExist.investmentTaxAmount,
                    operatorsSalaryDetail: salaryExist.operatorsSalaryDetail,
                    totalOperatorSalary: salaryExist.totalOperatorSalary,
                    developerSalaryDetail: salaryExist.developerSalaryDetail,
                    totalDeveloperSalary: salaryExist.totalDeveloperSalary,
                    totalAdminSalary: salaryExist.totalAdminSalary,
                    title: salaryExist.title,
                    startDate: salaryExist.startDate.toString(),
                    endDate: salaryExist.endDate.toString()
                }
            }else{
                const updatedSalary = await this.mainCalculate(body,start,end,title);
                await this.SalaryRepository.update( salaryExist.id,updatedSalary);
                return{
                    totalFinalProfit: updatedSalary.totalFinalProfit,
                    investmentTaxPercent: updatedSalary.investmentTaxPercent,
                    investmentTaxAmount: updatedSalary.investmentTaxAmount,
                    operatorsSalaryDetail: updatedSalary.operatorsSalaryDetail,
                    totalOperatorSalary: updatedSalary.totalOperatorSalary,
                    developerSalaryDetail: updatedSalary.developerSalaryDetail,
                    totalDeveloperSalary: updatedSalary.totalDeveloperSalary,
                    totalAdminSalary: updatedSalary.totalAdminSalary,
                    title: updatedSalary.title,
                    startDate: updatedSalary.startDate.toString(),
                    endDate: updatedSalary.endDate.toString()
                }
            }
        }else{
            const salaryLog = await this.mainCalculate(body,start, end, title);
            await this.SalaryRepository.save(salaryLog);
        
            return{
                totalFinalProfit: salaryLog.totalFinalProfit,
                investmentTaxPercent: salaryLog.investmentTaxPercent,
                investmentTaxAmount: salaryLog.investmentTaxAmount,
                operatorsSalaryDetail: salaryLog.operatorsSalaryDetail,
                totalOperatorSalary: salaryLog.totalOperatorSalary,
                developerSalaryDetail: salaryLog.developerSalaryDetail,
                totalDeveloperSalary: salaryLog.totalDeveloperSalary,
                totalAdminSalary: salaryLog.totalAdminSalary,
                title: salaryLog.title,
                startDate: salaryLog.startDate.toString(),
                endDate: salaryLog.endDate.toString()
            }
        }
    }

    async mainCalculate(body: SalaryReq, start: any, end: any, title: string): Promise<any>{
        body.profit = body.profit - body.loss;
        const investmentPercent = await this.referenceRepository.findOne({ where: { key: 'InvestmentTax' } });
        const investmenTax = body.profit*(Number(investmentPercent?.value)/100);
        const pureProfit = body.profit*((100-Number(investmentPercent?.value))/100);
        //Find supports and calculate salary
        const users: User[] = await this.getUsersByRole(UserRole.SUPPORT);
        const operatorIds = users.map((users) => users.id);
        const supportWallets = await this.walletRepository.find({where :{userId: In(operatorIds),},});
        const usersWalletDataSave = (data: any[]) => {
          return data.map(async item => {
            const supportId = item.userId;
            const supportUser = await this.userRepository.findOne({ where: { id: supportId } });
            const supportName = supportUser?.firstName;
            const supportWalletBalance = Number(item.balance);
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
        const minusOperatorSalary = pureProfit - totalOperatorsSalary;
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
        const salaryLog = this.SalaryRepository.create({
            totalFinalProfit: body.profit,
            investmentTaxPercent: investmentPercent?.value + '%',
            investmentTaxAmount: investmenTax,
            runningCosts: body.loss,
            operatorsSalaryDetail: approvedWallets,
            totalOperatorSalary: totalOperatorsSalary,
            developerSalaryDetail: developerSalaryDetail,
            totalDeveloperSalary: totalDeveloperSalary,
            totalAdminSalary: adminSalary,
            title: title,
            startDate: start,
            endDate: end
        });
        return salaryLog;
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

function getSalaryDate(): {start: any; end: any; title: string}{
  const today = new Date();
    // First day logic
    const firstDay = new Date(today);
    const lastDay = new Date(today);
    let titleName = '';
    lastDay.setDate(today.getDate() - 1);
    lastDay.setHours(23, 59, 59, 999);
    const dayOfMonth = today.getDate(); // Get the current day of the month

    if (dayOfMonth === 5) {
        firstDay.setMonth(today.getMonth() - 1);  // Go back to previous month
        firstDay.setDate(20); // Set the date to the 20th
        titleName = (firstDay.getMonth()+1) + ' дугаар сар II ашиг бодолт';
    }
    else if (dayOfMonth === 20) {
        titleName = (today.getMonth()+1) + ' дугаар сар I ашиг бодолт';
        firstDay.setDate(5); // Set the date to the 1st
    }
    else {
      throw new BadRequestException('Invalid date: Must be the 5th or 20th.');
    }
    firstDay.setHours(0,0,0,0);
    return {
      start:firstDay,
      end: lastDay,
      title: titleName
    };
}