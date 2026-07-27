import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EsimInvoice } from "src/entities/esim-invoice.entity";
import { CustomerPurchaseDto } from "src/transactions/dto/customer-purchase.dto";
import { QueryEsimDto } from "src/transactions/dto/query-esim.dto";
import { QpayConnectionService } from "src/transactions/services/qpay.connection.service";
import { TransactionsService } from "src/transactions/transactions.service";
import { Repository } from "typeorm";

@Injectable()
export class OperatorService {
    private readonly logger = new Logger(OperatorService.name);

    constructor(
        @InjectRepository(EsimInvoice)
        private readonly esimInvoiceRepository: Repository<EsimInvoice>,
        private readonly transactionsService: TransactionsService,
        private readonly qpayConnectionService: QpayConnectionService
    ){}

    //Чатаар борлуулалт хийхэд QPay нэхэмжлэлийг үүсгэхэд ашиглана
    async getQPayInvoice(dto: CustomerPurchaseDto): Promise<any>{
        //processCustomerPurchase(dto: CustomerPurchaseDto)
        const invoice = await this.transactionsService.processCustomerPurchase(dto);
        return invoice;
    }

    //Тухайн хэрэглэгчийн төлбөрийн мэдээллийг шалгахад ашиглана
    async checkPaymentStatus(qpayInvoiceId: string): Promise<any>{
        const invoiceStatus = (await this.qpayConnectionService.checkInvoice(
            qpayInvoiceId,
        )) as {
            count: number;
            rows?: Array<{ payment_status: string }>;
            [key: string]: unknown;
        };

        // Check if invoice is paid
        const isPaid =
            invoiceStatus.count > 0 &&
            invoiceStatus.rows?.some(
            (row: { payment_status: string }) => row.payment_status === 'PAID',
        );

        if (isPaid) {
            const esimInvoice = await this.transactionsService.getEsimInvoiceByQpayId(qpayInvoiceId);

            if (esimInvoice && esimInvoice.packageCode) {
                // Check if already processed
                if (
                  esimInvoice.status !== 'PROCESSED' &&
                  esimInvoice.status !== 'PAID'
                ) {
                    try {
                        // Inquire eSIM package details from API using packageCode
                        this.logger.log(
                          `Fetching eSIM package details for packageCode: ${esimInvoice.packageCode}`,
                        );
                        const packages =
                          await this.transactionsService.getPackageDetailsByCode(
                            esimInvoice.packageCode,
                          );
                      
                        if (!packages || packages.length === 0) {
                          throw new NotFoundException(
                            `Package not found for packageCode: ${esimInvoice.packageCode}`,
                          );
                        }
                    
                        const packageDetails = packages[0];
                        if (!packageDetails) {
                          throw new NotFoundException(
                            `Package details not found for packageCode: ${esimInvoice.packageCode}`,
                          );
                        }
                    
                        this.logger.log(
                          `Found package: ${packageDetails.name}, Price: ${packageDetails.price} ${packageDetails.currencyCode}`,
                        );
                    
                        // Use price from API response (already in API format)
                        // API price is in units where 10000 = $1.00
                        const packagePrice = Number(packageDetails.price);
                    
                        const orderEsimDto = {
                          transactionId: undefined, // Will be auto-generated (eSIM order transaction ID)
                          amount: packagePrice,
                          packageInfoList: [
                            {
                              packageCode: esimInvoice.packageCode,
                              count: 1,
                              price: packagePrice,
                            },
                          ],
                        };
                    
                        // Place eSIM order
                        // Note: orderEsimForCustomer already updates the invoice status to 'PAID'
                        // and creates ESimPurchase records, so no need to update status again
                        const orderResult =
                          await this.transactionsService.orderEsimForCustomer(
                            qpayInvoiceId, // Pass QPay invoice ID
                            orderEsimDto,
                          );
                      
                        // Get orderNo from ESimPurchase records if available (more reliable)
                        let esimOrderNo = orderResult.orderNo;
                        try {
                          const purchases =
                            await this.transactionsService.getEsimPurchasesByInvoiceId(
                              esimInvoice.id,
                            );
                          if (purchases.length > 0 && purchases[0].orderNo) {
                            esimOrderNo = purchases[0].orderNo;
                          }
                        } catch (error) {
                          // If we can't get from purchases, use orderResult.orderNo
                          this.logger.warn(
                            `Could not retrieve orderNo from purchases, using orderResult: ${error instanceof Error ? error.message : 'Unknown'}`,
                          );
                        }

                        const dto: QueryEsimDto = {
                          orderNo: esimOrderNo
                          // Other fields can be left undefined for this query
                        };
                        // Send email notification to customer about successful purchase and order placement
                        await this.transactionsService.queryEsimPurchases(dto);

                        
                        return {
                          ...invoiceStatus,
                          orderPlaced: true,
                          orderNo: esimOrderNo || orderResult.orderNo || null,
                          transactionId: orderResult.transactionId,
                          message: 'Invoice paid and eSIM order placed successfully',
                        };
                        
                    } catch (error) {
                        this.logger.error(
                          `Failed to place eSIM order for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}): ${error instanceof Error ? error.message : 'Unknown error'}`,
                        );
                    
                        // Try to get orderNo from ESimPurchase records even if order failed
                        let esimOrderNo: string | null = null;
                        try {
                          const purchases =
                            await this.transactionsService.getEsimPurchasesByInvoiceId(
                              esimInvoice.id,
                            );
                          if (purchases.length > 0 && purchases[0].orderNo) {
                            esimOrderNo = purchases[0].orderNo;
                          }
                        } catch {
                          // Ignore error, orderNo will be null
                        }
                    
                        // Return invoice status even if order fails
                        return {
                          ...invoiceStatus,
                          orderPlaced: false,
                          orderNo: esimOrderNo || null,
                          error:
                            error instanceof Error
                              ? error.message
                              : 'Failed to place eSIM order',
                          message: 'Invoice is paid but eSIM order failed',
                        };
                    }
                } else {
                  // Already processed
                  const invoiceData = esimInvoice.invoiceData as
                    | { orderNo?: string }
                    | undefined;
        
                  // Try to get orderNo from ESimPurchase records
                  let esimOrderNo = invoiceData?.orderNo;
                  try {
                    const purchases =
                      await this.transactionsService.getEsimPurchasesByInvoiceId(
                        esimInvoice.id,
                      );
                    if (purchases.length > 0 && purchases[0].orderNo) {
                      esimOrderNo = purchases[0].orderNo;
                    }
                  } catch (error) {
                    // If we can't get from purchases, use invoiceData.orderNo
                    this.logger.warn(
                      `Could not retrieve orderNo from purchases for already processed invoice: ${error instanceof Error ? error.message : 'Unknown'}`,
                    );
                  }
        
                  return {
                    ...invoiceStatus,
                    orderPlaced: true,
                    alreadyProcessed: true,
                    orderNo: esimOrderNo || null,
                    message: 'Invoice already processed',
                  };
                }
            }
        }

        let esimOrderNo: string | null = null;
        if (isPaid) {
          try {
            const esimInvoice =
              await this.transactionsService.getEsimInvoiceByQpayId(qpayInvoiceId);
            if (esimInvoice) {
              // Try to get orderNo from ESimPurchase records
              try {
                const purchases =
                  await this.transactionsService.getEsimPurchasesByInvoiceId(
                    esimInvoice.id,
                  );
                if (purchases.length > 0 && purchases[0].orderNo) {
                  esimOrderNo = purchases[0].orderNo;
                } else {
                  // Try from invoiceData
                  const invoiceData = esimInvoice.invoiceData as
                    | { orderNo?: string }
                    | undefined;
                  if (invoiceData?.orderNo) {
                    esimOrderNo = invoiceData.orderNo;
                  }
                }
              } catch {
                // Try from invoiceData as fallback
                const invoiceData = esimInvoice.invoiceData as
                  | { orderNo?: string }
                  | undefined;
                if (invoiceData?.orderNo) {
                  esimOrderNo = invoiceData.orderNo;
                }
              }
            }
          } catch {
            // Ignore error, orderNo will be null
          }
        }

        // Return invoice status (not paid or no invoice found)
        return {
          ...invoiceStatus,
          orderPlaced: false,
          orderNo: esimOrderNo || null,
          message: isPaid
            ? 'Invoice paid but no eSIM invoice found'
            : 'Invoice not paid yet',
        };
    }

    //Буцаалт хийхэд ашиглана
    async refundPayment(): Promise<any>{
        return {
        "success": true,
        }
    }

    //Нийт нэхэмжлэлийн мэдээллийг авахад ашиглана мөн мэйл болон утасны дугаараар хайлт хийх боломжтой
    async getAllInvoices(email?: string, phoneNumber?: string): Promise<any> {
        const InvoiceOrders = await this.esimInvoiceRepository
            .createQueryBuilder('invoice')
            .leftJoinAndSelect("invoice.customer", "customer")
            .leftJoin("packages", "package", "package.package_code = invoice.packageCode") // 👈 join here
            .select([
                "invoice.id",
                "invoice.qpayInvoiceId",
                "invoice.createdAt",
                "invoice.amount",
                "invoice.status",
                "invoice.iccId",
                "customer.email",
                "customer.phoneNumber",
                "package.name" // 👈 select package name
            ])
            .where(email ? 'customer.email = :email' : '1=1', { email })
            .andWhere(phoneNumber ? 'customer.phoneNumber = :phoneNumber' : '1=1', { phoneNumber })
            .orderBy('invoice.createdAt', 'DESC')
            .getRawMany(); // 👈 use getRawMany since package is not entity relation
        
        return {
            success: true,
            data: InvoiceOrders
        };
    }
}