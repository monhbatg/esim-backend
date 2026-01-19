import { Injectable, Logger } from '@nestjs/common';
import { QpayConnectionService } from './qpay.connection.service';
import { TransactionsService } from '../transactions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { EsimInvoice } from '../../entities/esim-invoice.entity';

@Injectable()
export class InvoiceSchedulerService {
  private readonly logger = new Logger(InvoiceSchedulerService.name);

  constructor(
    private readonly qpayConnectionService: QpayConnectionService,
    private readonly transactionsService: TransactionsService,
    @InjectRepository(EsimInvoice)
    private readonly esimInvoiceRepo: Repository<EsimInvoice>,
  ) {}

  /**
   * Schedule invoice checks by storing metadata in database
   * Vercel cron jobs will call the API endpoints at scheduled times
   * This approach works in serverless environment without Redis
   */
  async scheduleInvoiceChecks(qpayInvoiceId: string): Promise<void> {
    this.logger.log(`Scheduling invoice checks for QPay ID: ${qpayInvoiceId}`);

    try {
      // Find the invoice record
      const esimInvoice = await this.esimInvoiceRepo.findOne({
        where: { qpayInvoiceId },
      });

      if (!esimInvoice) {
        this.logger.warn(`EsimInvoice not found for QPay ID: ${qpayInvoiceId}`);
        return;
      }

      // Update invoice with check metadata for tracking
      await this.esimInvoiceRepo.update(
        { qpayInvoiceId },
        {
          checkScheduledAt: new Date(),
          nextCheckTime: new Date(Date.now() + 5 * 60 * 1000), // Next check in 5 minutes
        },
      );

      this.logger.log(
        `Successfully marked invoice checks for QPay ID: ${qpayInvoiceId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to schedule invoice checks for ${qpayInvoiceId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    }
  }

  /**
   * Process pending invoice checks (called by Vercel cron jobs)
   * Finds all invoices that need checking and processes them
   */
  async processPendingInvoiceChecks(checkIntervalMinutes: number): Promise<void> {
    this.logger.log(
      `Processing pending invoice checks (interval: ${checkIntervalMinutes} min)`,
    );

    try {
      // Find all invoices that were scheduled for checking and are not yet processed
      const pendingInvoices = await this.esimInvoiceRepo.find({
        where: {
          checkScheduledAt: LessThan(
            new Date(Date.now() - checkIntervalMinutes * 60 * 1000),
          ),
          status: 'PENDING',
        },
        order: { createdAt: 'DESC' },
      });

      this.logger.log(
        `Found ${pendingInvoices.length} invoices to check`,
      );

      for (const esimInvoice of pendingInvoices) {
        await this.performInvoiceCheck(esimInvoice);
      }
    } catch (error) {
      this.logger.error(
        `Error processing pending invoice checks: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Perform a single invoice status check
   */
  private async performInvoiceCheck(esimInvoice: EsimInvoice): Promise<void> {
    const qpayInvoiceId = esimInvoice.qpayInvoiceId;

    try {
      this.logger.log(
        `Performing invoice check for QPay ID: ${qpayInvoiceId}`,
      );

      // Check invoice status from QPay
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
        this.logger.log(
          `Invoice ${qpayInvoiceId} is paid. Processing eSIM order...`,
        );

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
                throw new Error(
                  `Package not found for packageCode: ${esimInvoice.packageCode}`,
                );
              }

              const packageDetails = packages[0];
              if (!packageDetails) {
                throw new Error(
                  `Package details not found for packageCode: ${esimInvoice.packageCode}`,
                );
              }

              this.logger.log(
                `Found package: ${packageDetails.name}, Price: ${packageDetails.price} ${packageDetails.currencyCode}`,
              );

              // Use price from API response
              const packagePrice = Number(packageDetails.price);

              const orderEsimDto = {
                transactionId: undefined, // Will be auto-generated
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
              const orderResult =
                await this.transactionsService.orderEsimForCustomer(
                  qpayInvoiceId,
                  orderEsimDto,
                );

              await this.transactionsService.queryEsimPurchases({
                orderNo: orderResult.orderNo,
              });

              // Check email sent status
              if (esimInvoice) {
                const emailSentStatus = esimInvoice.isSentEmail
                  ? 'Email sent'
                  : 'Email not sent';
                if (emailSentStatus === 'Email not sent') {
                  await this.transactionsService.queryEsimPurchases({
                    orderNo: orderResult.orderNo,
                  });
                }
              } else {
                this.logger.warn(
                  `EsimInvoice not found for QPay ID: ${qpayInvoiceId}`,
                );
              }

              this.logger.log(
                `eSIM order placed successfully for invoice ${qpayInvoiceId}. Order No: ${orderResult.orderNo}`,
              );
            } catch (error) {
              this.logger.error(
                `Failed to place eSIM order for invoice ${qpayInvoiceId}: ${
                  error instanceof Error ? error.message : 'Unknown error'
                }`,
              );
            }
          } else {
            this.logger.log(
              `Invoice ${qpayInvoiceId} already processed`,
            );
          }
        }
      } else {
        this.logger.log(
          `Invoice ${qpayInvoiceId} check: Not paid yet`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error during invoice check for ${qpayInvoiceId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
