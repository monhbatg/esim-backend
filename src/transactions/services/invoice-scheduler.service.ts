import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { QpayConnectionService } from './qpay.connection.service';
import { TransactionsService } from '../transactions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EsimInvoice } from '../../entities/esim-invoice.entity';

@Injectable()
export class InvoiceSchedulerService {
  private readonly logger = new Logger(InvoiceSchedulerService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly qpayConnectionService: QpayConnectionService,
    private readonly transactionsService: TransactionsService,
  ) {}

  /**
   * Schedule automatic invoice status checks after invoice creation
   * Checks 4 times: at 5min, 10min, 15min, and 20min after creation
   * NOTE: This only works in non-serverless environments (not Vercel)
   */
  async scheduleInvoiceChecks(qpayInvoiceId: string): Promise<void> {
    // Skip scheduling in Vercel serverless environment
    if (process.env.VERCEL) {
      this.logger.log(`Skipping invoice scheduling for ${qpayInvoiceId} - running in Vercel serverless environment`);
      this.logger.log(`For automatic invoice checking on Vercel, use Vercel Cron Jobs or external cron services`);
      return;
    }

    this.logger.log(`Scheduling invoice checks for QPay ID: ${qpayInvoiceId}`);

    // Schedule check at 5 minutes
    const timeout5min = setTimeout(async () => {
      await this.performInvoiceCheck(qpayInvoiceId, 1);
    }, 5 * 60 * 1000); // 5 minutes

    // Schedule check at 10 minutes
    const timeout10min = setTimeout(async () => {
      await this.performInvoiceCheck(qpayInvoiceId, 2);
    }, 10 * 60 * 1000); // 10 minutes

    // Schedule check at 15 minutes
    const timeout15min = setTimeout(async () => {
      await this.performInvoiceCheck(qpayInvoiceId, 3);
    }, 15 * 60 * 1000); // 15 minutes

    // Schedule check at 20 minutes
    const timeout20min = setTimeout(async () => {
      await this.performInvoiceCheck(qpayInvoiceId, 4);
    }, 20 * 60 * 1000); // 20 minutes

    // Register timeouts for potential cleanup
    this.schedulerRegistry.addTimeout(
      `invoice-check-5min-${qpayInvoiceId}`,
      timeout5min,
    );
    this.schedulerRegistry.addTimeout(
      `invoice-check-10min-${qpayInvoiceId}`,
      timeout10min,
    );
    this.schedulerRegistry.addTimeout(
      `invoice-check-15min-${qpayInvoiceId}`,
      timeout15min,
    );
    this.schedulerRegistry.addTimeout(
      `invoice-check-20min-${qpayInvoiceId}`,
      timeout20min,
    );
  }

  /**
   * Perform a single invoice status check
   */
  private async performInvoiceCheck(
    qpayInvoiceId: string,
    checkNumber: number,
  ): Promise<void> {
    try {
      this.logger.log(
        `Performing invoice check ${checkNumber} for QPay ID: ${qpayInvoiceId}`,
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

        // Find the EsimInvoice record by QPay invoice ID
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
                const emailSentStatus = esimInvoice.isSentEmail ? 'Email sent' : 'Email not sent';
                if (emailSentStatus === 'Email not sent') {
                  await this.transactionsService.queryEsimPurchases({
                    orderNo: orderResult.orderNo,
                  });
                }
              } else {
                this.logger.warn(`EsimInvoice not found for QPay ID: ${qpayInvoiceId}`);
              }

              this.logger.log(
                `eSIM order placed successfully for invoice ${qpayInvoiceId}. Order No: ${orderResult.orderNo}`,
              );

              // Cancel remaining scheduled checks since order is placed
              this.cancelRemainingChecks(qpayInvoiceId, checkNumber);
            } catch (error) {
              this.logger.error(
                `Failed to place eSIM order for invoice ${qpayInvoiceId}: ${
                  error instanceof Error ? error.message : 'Unknown error'
                }`,
              );
            }
          } else {
            this.logger.log(
              `Invoice ${qpayInvoiceId} already processed. Cancelling remaining checks.`,
            );
            // Cancel remaining scheduled checks
            this.cancelRemainingChecks(qpayInvoiceId, checkNumber);
          }
        }
      } else {
        this.logger.log(
          `Invoice ${qpayInvoiceId} check ${checkNumber}: Not paid yet`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error during invoice check ${checkNumber} for ${qpayInvoiceId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Cancel remaining scheduled checks for an invoice
   */
  private cancelRemainingChecks(
    qpayInvoiceId: string,
    currentCheckNumber: number,
  ): void {
    const checkTimes = [5, 10, 15, 20]; // minutes
    for (let i = currentCheckNumber; i < checkTimes.length; i++) {
      const timeoutName = `invoice-check-${checkTimes[i]}min-${qpayInvoiceId}`;
      try {
        const timeout = this.schedulerRegistry.getTimeout(timeoutName);
        if (timeout) {
          clearTimeout(timeout);
          this.schedulerRegistry.deleteTimeout(timeoutName);
          this.logger.log(`Cancelled scheduled check: ${timeoutName}`);
        }
      } catch (error) {
        // Timeout might not exist or already executed
      }
    }
  }
}