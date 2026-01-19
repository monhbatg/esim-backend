import { NestFactory } from '@nestjs/core';
import { TransactionsModule } from '../../transactions/transactions.module';
import { InvoiceSchedulerService } from '../../transactions/services/invoice-scheduler.service';

// This is a Vercel cron handler that runs every 15 minutes
export default async (req, res) => {
  try {
    const app = await NestFactory.create(TransactionsModule, undefined, {
      logger: false,
    });

    const invoiceSchedulerService = app.get(InvoiceSchedulerService);

    // Process invoices that need checking at 15 minute interval
    await invoiceSchedulerService.processPendingInvoiceChecks(15);

    res.status(200).json({ success: true, message: 'Processed invoices at 15min check' });
  } catch (error) {
    console.error('Cron job error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
