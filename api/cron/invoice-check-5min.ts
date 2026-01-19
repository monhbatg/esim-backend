import { NestFactory } from '@nestjs/core';
import { TransactionsModule } from '../../transactions/transactions.module';
import { InvoiceSchedulerService } from '../../transactions/services/invoice-scheduler.service';

// This is a Vercel cron handler that runs every 5 minutes
export default async (req, res) => {
  try {
    // Create a minimal NestJS app to get services
    const app = await NestFactory.create(TransactionsModule, undefined, {
      logger: false,
    });

    const invoiceSchedulerService = app.get(InvoiceSchedulerService);

    // Process invoices that need checking at 5 minute interval
    await invoiceSchedulerService.processPendingInvoiceChecks(5);

    res.status(200).json({ success: true, message: 'Processed invoices at 5min check' });
  } catch (error) {
    console.error('Cron job error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
