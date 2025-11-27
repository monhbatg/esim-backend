/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { HttpService } from '@nestjs/axios';
import { BadRequestException, forwardRef, HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { ApiDataObject } from '../../inquiry/dto/data-package.dto';
import { SystemConfig } from '../../entities/system-config.entity';
import { InvoiceRequest } from '../dto/invoice.request.dto';
import { TokenResponse } from '../dto/token.response.dto';
import { MailService } from './mail.service';
import { OrderEsimDto } from '../dto/order-esim.dto';
import { Transaction } from 'src/entities/transaction.entity';
import { EsimInvoice } from 'src/entities/esim-invoice.entity';
import { AxiosError } from 'axios';
import { ESimPurchase } from 'src/entities/esim-purchase.entity';
import { Customer } from 'src/entities/customer.entity';
import { InquiryPackagesService } from 'src/inquiry/services/inquiry.packages.service';
import { QueryEsimDto } from '../dto/query-esim.dto';
import { TransactionsService } from '../transactions.service';

interface InvoiceResponse {
  invoice_id: string;
  qr_image: string;
  qr_link: string;
  // add other response fields as needed
}

interface ApiResponse {
  errorCode: string | null;
  errorMsg: string | null;
  success: boolean;
  obj: ApiDataObject;
}

@Injectable()
export class QpayConnectionService {
  private readonly logger = new Logger(QpayConnectionService.name);
  private readonly qpayBaseUrl = process.env.QPAY_API_URL;
  private readonly qpayUser = process.env.QPAY_API_USER;
  private readonly qpaySecret = process.env.QPAY_API_SECRET;
  private readonly qpayInvoiceCode = process.env.QPAY_INVOICE_CODE;
  private readonly apiBaseUrl = 'https://api.esimaccess.com/api/v1';
  private readonly accessCode = process.env.ESIM_ACCESS_CODE;
  private readonly transactionsService: TransactionsService;

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(ESimPurchase)
    private readonly esimPurchaseRepository: Repository<ESimPurchase>,
    @InjectRepository(EsimInvoice)
    private readonly esimInvoiceRepository: Repository<EsimInvoice>,
    private readonly httpService: HttpService,
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => InquiryPackagesService))
    private readonly inquiryPackagesService: InquiryPackagesService,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    //private readonly transactionsService: TransactionsService
  ) {
    // Validate env vars on service creation
    if (!this.qpayUser || !this.qpaySecret || !this.qpayInvoiceCode) {
      throw new Error(
        'Missing QPAY_API_USER, QPAY_API_SECRET, or QPAY_INVOICE_CODE in .env',
      );
    }
  }

  async getToken(): Promise<TokenResponse> {
    const configKey = 'QPAY_TOKEN';
    const now = new Date();

    // 1. Try to get from DB
    const cachedConfig = await this.configRepo.findOne({
      where: { key: configKey },
    });

    if (
      cachedConfig &&
      cachedConfig.expiresAt &&
      cachedConfig.expiresAt > now
    ) {
      this.logger.log('Using cached QPay token');
      return JSON.parse(cachedConfig.value) as TokenResponse;
    }

    try {
      const url = `${this.qpayBaseUrl}/auth/token`;
      this.logger.log(`Fetching token from: ${url}`);

      const response: any = await firstValueFrom(
        this.httpService.post<TokenResponse>(
          url,
          {},
          {
            auth: {
              username: this.qpayUser!,
              password: this.qpaySecret!,
            },
            headers: {
              Authorization: 'Basic',
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const tokenData = response.data;
      this.logger.log(`Token fetched successfully ${tokenData.access_token}`);

      // Save to DB
      const expiresIn = 86400; // Default 24 hours token life time
      const expiresAt = new Date(now.getTime() + expiresIn * 1000);

      await this.configRepo.save({
        key: configKey,
        value: JSON.stringify(tokenData),
        expiresAt: expiresAt,
        updatedAt: new Date()
      });

      return tokenData;
    } catch (error) {
      this.logger.error(
        `Error fetching token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async createInvoice(invoiceData: InvoiceRequest): Promise<InvoiceResponse> {
    try {
      this.logger.log(`Creating invoice: ${invoiceData.invoice_code}`);
      const finalInvoiceData = this.buildInvoice(invoiceData);
      // Get bearer token
      const token = await this.getToken();
      this.logger.log(`Using access token: ${token.access_token}`);

      // Construct invoice endpoint (adjust URL path if needed)
      const invoiceUrl = `${this.qpayBaseUrl}/invoice`;

      const response = await firstValueFrom(
        this.httpService.post<InvoiceResponse>(invoiceUrl, finalInvoiceData, {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(
        `Invoice created successfully. invoice_id: ${response.data.invoice_id}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Error creating invoice: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  private buildInvoice(invoiceData: InvoiceRequest): InvoiceRequest {
    return {
      ...invoiceData,
      invoice_code: this.qpayInvoiceCode!,
      sender_invoice_no:
        invoiceData.sender_invoice_no || `GOY_SIM-${Date.now()}`,
      invoice_receiver_code: invoiceData.invoice_receiver_code || 'GOY_SIM',
      sender_branch_code: invoiceData.sender_branch_code || 'BRANCH001',
      invoice_description:
        invoiceData.invoice_description || 'Default Invoice Description',
      enable_expiry: invoiceData.enable_expiry ?? false,
      allow_partial: invoiceData.allow_partial ?? false,
      minimum_amount: invoiceData.minimum_amount ?? null,
      allow_exceed: invoiceData.allow_exceed ?? false,
      maximum_amount: invoiceData.maximum_amount ?? null,
      callback_url: invoiceData.callback_url || '',
      sender_staff_code: invoiceData.sender_staff_code || 'online',
      sender_terminal_code: invoiceData.sender_terminal_code || undefined,
      sender_terminal_data: invoiceData.sender_terminal_data || { name: null },
      allow_subscribe: invoiceData.allow_subscribe ?? false,
      note: invoiceData.note || undefined,
    };
  }

  async checkInvoice(invoiceId: string): Promise<any> {
    try {
      this.logger.log(`Checking invoice status: ${invoiceId}`);

      // Get bearer token
      const token = await this.getToken();

      // Construct check invoice endpoint
      const checkUrl = `${this.qpayBaseUrl}/payment/check`;

      const response = await firstValueFrom(
        this.httpService.post<InvoiceResponse>(
          checkUrl,
          {
            object_type: 'INVOICE',
            object_id: invoiceId,
            offset: {
              page_number: 1,
              page_limit: 100,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      this.logger.log(
        `Invoice status retrieved. invoice_id: ${invoiceId}, status: ${JSON.stringify(response.data as any)}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Error checking invoice: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  
  async topupEsim(qpayInvoiceId: string): Promise<Record<string, unknown>> {

  // Check invoice status from QPay
      const invoiceStatus = (await this.checkInvoice(
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
        // Find the EsimInvoice record by QPay invoice ID
        // Note: qpayInvoiceId is the external QPay payment system ID
        // esimInvoice.id is our internal database UUID
        const esimInvoice =
          await this.transactionsService.getEsimInvoiceByQpayId(qpayInvoiceId);
  
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
                await this.topupEsimForCustomer(
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
  
      // Return invoice status (not paid or no invoice found)
      // Try to get orderNo even if invoice not found or not paid
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
    //Topup response deerees dahin myEsim duudaad tuuneese  dahij bichiltee barij awaad  esim_purchases table ruu log bichih 
    //heregtei bolj baina ter hesgiig ene hesegt hiij hugjuulne eswel controller heseg deer tuhain logic uildiig hiih heregtei bolno
    
    //await this.mailService.sendMail('btbaadii0916@gmail.com','Hi', 'Hi');
    //return data;
  }

  async topupEsimForCustomer(
    qpayInvoiceId: string,
    orderEsimDto: OrderEsimDto,
  ): Promise<{
    orderNo: string;
    transactionId: string;
    amount: number;
  }> {
    // Validate access code is configured
    if (!this.accessCode) {
      this.logger.error('ESIM_ACCESS_CODE is not configured');
      throw new BadRequestException('eSIM service is not properly configured');
    }

    // Generate eSIM order transaction ID if not provided
    // This is used for the eSIM API order, not the same as Transaction entity
    let esimOrderTransactionId = orderEsimDto.transactionId;
    if (!esimOrderTransactionId) {
      esimOrderTransactionId = this.transactionsService.generateTransactionId();
      // Ensure uniqueness (retry if collision - extremely rare)
      let attempts = 0;
      while (
        (await this.transactionRepository.findOne({
          where: { transactionId: esimOrderTransactionId },
        })) &&
        attempts < 10
      ) {
        esimOrderTransactionId = this.transactionsService.generateTransactionId();
        attempts++;
      }
    }

    // Find the EsimInvoice by QPay invoice ID
    // Note: qpayInvoiceId is the external QPay system ID, esimInvoice.id is our internal database ID
    const esimInvoice = await this.esimInvoiceRepository.findOne({
      where: { qpayInvoiceId: qpayInvoiceId },
      relations: ['customer'],
    });

    if (!esimInvoice) {
      throw new NotFoundException(
        `Invoice not found for QPay invoice ID: ${qpayInvoiceId}`,
      );
    }

    // Check if already processed
    if (esimInvoice.status === 'PROCESSED' || esimInvoice.status === 'PAID') {
      this.logger.log(
        `Invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}) already processed, skipping order`,
      );
      // Return existing order data if available
      if (esimInvoice.invoiceData?.orderNo) {
        return {
          orderNo: esimInvoice.invoiceData.orderNo,
          transactionId:
            esimInvoice.invoiceData.transactionId || esimOrderTransactionId,
          amount: esimInvoice.amount,
        };
      }
      throw new BadRequestException('Invoice already processed');
    }

    try {
      // Prepare request body for eSIM Access API
      const requestBody: any = {
        esimTranNo: "",
        iccid: "iccId here",
        packageCode: "",
        transactionId: esimOrderTransactionId
      };

      // Call eSIM Access API to place order
      //const url = `${this.apiBaseUrl}/open/esim/order`;
      const url = `${this.apiBaseUrl}/open/esim/topup`;
      this.logger.log(
        `Placing eSIM Top-up for customer invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}), eSIM Top-up TransactionId: ${esimOrderTransactionId}`,
      );

      let orderResponse: any;
      let topupResponse: any;
      try {
        const response = await firstValueFrom(
          this.httpService.post(url, requestBody, {
            headers: {
              'RT-AccessCode': this.accessCode,
              'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 seconds timeout for order API
          }),
        );

        orderResponse = response.data;
        topupResponse = response.data;
        this.logger.log(
          `eSIM Top-up API response received for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id})`,
        );
      } catch (error) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `eSIM Top-up API call failed for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}): ${axiosError.message}`,
          axiosError.stack,
        );

        // Extract error message from response if available
        let errorMessage = 'Failed to place eSIM Top-up';
        if (axiosError.response?.data) {
          const errorData = axiosError.response.data as any;
          errorMessage =
            errorData.errorMsg ||
            errorData.message ||
            `API Error: ${axiosError.response.status}`;
        } else if (
          axiosError.code === 'ECONNABORTED' ||
          axiosError.message.includes('timeout')
        ) {
          errorMessage = 'eSIM provider API request timed out';
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: errorMessage,
            error: 'eSIM Order Failed',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate API response
      if (!topupResponse || !topupResponse.success) {
        const errorMsg =
          topupResponse?.errorMsg ||
          'Top-up failed - invalid response from eSIM provider';
        this.logger.error(
          `eSIM Top-up failed for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}): ${errorMsg}`,
          JSON.stringify(orderResponse),
        );

        throw new BadRequestException(errorMsg);
      }

      //now i need to check MY eSIM list
      const queryData: QueryEsimDto = {
        orderNo:"",
        esimTranNo:"",
        iccid: "ICCID",
      }
      const currentEsim = await this.transactionsService.queryEsimPurchases(queryData);
      // Extract order number from response
      const orderNo = currentEsim.obj.esimList[0].orderNo;
      if (!orderNo) {
        this.logger.error(
          `Top-up response missing transactionId for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id})`,
          JSON.stringify(topupResponse),
        );

        throw new BadRequestException('Top-up response missing transactionId number');
      }

      // Update EsimInvoice with order details and mark as paid (order completed)
      // Status is set to 'PAID' since the order is placed synchronously and completes immediately
      esimInvoice.status = 'PAID';
      const topupResponseData = topupResponse.obj || topupResponse;
      esimInvoice.invoiceData = {
        ...esimInvoice.invoiceData,
        orderNo,
        transactionId: esimOrderTransactionId, // Store eSIM order transaction ID
        esimOrderResponse: topupResponseData,
        processedAt: new Date().toISOString(),
      };

      // Use a database transaction to ensure invoice is saved and committed
      // before creating purchases. This prevents foreign key constraint violations.
      await this.dataSource.transaction(async (manager) => {
        // Save invoice within transaction
        const invoiceRepository = manager.getRepository(EsimInvoice);
        const savedInvoice = await invoiceRepository.save(esimInvoice);

        // Reload invoice with customer relation within the same transaction
        const invoiceWithCustomer = await invoiceRepository.findOne({
          where: { id: savedInvoice.id },
          relations: ['customer'],
        });

        if (!invoiceWithCustomer) {
          throw new Error(
            `Failed to reload invoice ${savedInvoice.id} after saving`,
          );
        }

        if (!invoiceWithCustomer.customer) {
          throw new Error(
            `Invoice ${invoiceWithCustomer.id} does not have a customer relation`,
          );
        }

        // Create purchases within the same transaction
        // This ensures the invoice exists when purchases are created
        try {
          await this.transactionsService.createEsimPurchasesInTransaction(
            topupResponseData,
            invoiceWithCustomer,
            esimOrderTransactionId,
            orderEsimDto,
            manager,
          );
        } catch (purchaseError) {
          this.logger.error(
            `Failed to create ESimPurchase records in transaction: ${purchaseError instanceof Error ? purchaseError.message : 'Unknown error'}`,
            purchaseError instanceof Error ? purchaseError.stack : undefined,
          );
          // Don't throw - let transaction complete, purchases can be created later via fallback
        }
      });

      // Try fallback method if transaction completed but purchases weren't created
      // This handles cases where the transaction succeeded but purchase creation failed
      try {
        const invoiceCheck = await this.esimInvoiceRepository.findOne({
          where: { id: esimInvoice.id },
          relations: ['customer'],
        });

        if (invoiceCheck && invoiceCheck.customer) {
          const existingPurchases = await this.esimPurchaseRepository.count({
            where: { invoiceId: invoiceCheck.id },
          });

          if (existingPurchases === 0) {
            this.logger.log(
              `No purchases found for invoice ${invoiceCheck.id}, attempting fallback creation`,
            );
            // Try to get esimTranNo and iccid from invoice data (stored in esimOrderResponse)
            const esimTranNo =
              invoiceCheck.invoiceData?.esimOrderResponse?.esimTranNo ||
              invoiceCheck.invoiceData?.esimOrderResponse?.obj?.esimTranNo ||
              null;
            const iccid =
              invoiceCheck.invoiceData?.esimOrderResponse?.iccid ||
              invoiceCheck.invoiceData?.esimOrderResponse?.obj?.iccid ||
              null;

            await this.transactionsService.createPurchasesFromPackageInfo(
              invoiceCheck,
              esimOrderTransactionId,
              orderEsimDto,
              invoiceCheck.invoiceData?.orderNo || null,
              esimTranNo,
              iccid,
            );
          }
        }
      } catch (fallbackError) {
        this.logger.error(
          `Fallback purchase creation also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`,
        );
      }

      this.logger.log(
        `eSIM order successful for customer invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}), OrderNo: ${orderNo}, eSIM Order TransactionId: ${esimOrderTransactionId}`,
      );

      return {
        orderNo,
        transactionId: esimOrderTransactionId,
        amount: orderEsimDto.amount,
      };
    } catch (error) {
      this.logger.error(
        `eSIM order failed for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}): ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      throw error;
    }
  }
    
}
