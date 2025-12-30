import { Controller, Post, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';

@ApiTags('cron')
@Controller('cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('check-pending-invoices')
  @ApiOperation({
    summary: 'Check all pending invoices (for cron jobs)',
    description: 'Manually check all pending invoices for payment status',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice checks completed',
  })
  async checkPendingInvoices(): Promise<{ message: string; checked: number; processed: number }> {
    this.logger.log('Starting cron job: checking pending invoices');

    try {
      // Get all pending invoices
      const pendingInvoices = await this.transactionsService.getPendingInvoices();

      let checked = 0;
      let processed = 0;

      for (const invoice of pendingInvoices) {
        try {
          checked++;

          // Check invoice status using existing check endpoint logic
          const result = await this.transactionsService.checkInvoiceStatus(invoice.qpayInvoiceId);

          if (result.orderPlaced) {
            processed++;
            this.logger.log(`Invoice ${invoice.qpayInvoiceId} processed successfully`);
          }
        } catch (error) {
          this.logger.error(`Failed to check invoice ${invoice.qpayInvoiceId}: ${error.message}`);
        }
      }

      return {
        message: `Checked ${checked} invoices, processed ${processed} payments`,
        checked,
        processed,
      };
    } catch (error) {
      this.logger.error(`Cron job failed: ${error.message}`);
      throw error;
    }
  }
}