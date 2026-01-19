# Code Examples: Invoice Auto-Check Integration

## 1. How to Schedule Invoice Checks

### In Transaction Service/Controller (When Creating Invoice)

```typescript
// transactions.service.ts

import { InvoiceSchedulerService } from './services/invoice-scheduler.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly invoiceSchedulerService: InvoiceSchedulerService,
    private readonly esimInvoiceRepo: Repository<EsimInvoice>,
    // ... other dependencies
  ) {}

  async createInvoiceForPurchase(customerId: string, packageCode: string): Promise<EsimInvoice> {
    // 1. Create invoice record
    const invoice = this.esimInvoiceRepo.create({
      customerId,
      packageCode,
      amount: 100,
      status: 'PENDING',
      senderInvoiceNo: `INV-${Date.now()}`,
      qpayInvoiceId: qpayResponse.invoice_id, // From QPay API
    });

    const savedInvoice = await this.esimInvoiceRepo.save(invoice);

    // 2. Schedule automatic checks (THIS IS THE KEY STEP)
    try {
      await this.invoiceSchedulerService.scheduleInvoiceChecks(
        savedInvoice.qpayInvoiceId
      );
      this.logger.log(`Scheduled checks for invoice ${savedInvoice.qpayInvoiceId}`);
    } catch (error) {
      this.logger.error(`Failed to schedule checks: ${error.message}`);
      // Invoice is created but checks won't be scheduled
      // User can still pay and trigger manual check
    }

    return savedInvoice;
  }
}
```

## 2. Cron Handler Implementation

### api/cron/invoice-check-5min.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { TransactionsModule } from '../../transactions/transactions.module';
import { InvoiceSchedulerService } from '../../transactions/services/invoice-scheduler.service';

/**
 * Vercel Cron Job Handler
 * Runs every 5 minutes to check invoices due for payment verification
 * 
 * Schedule: */5 * * * * (every 5 minutes)
 * Endpoint: /api/cron/invoice-check-5min
 */
export default async (req, res) => {
  // Verify this is a valid cron request (optional security)
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'production' && !authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log(`[${new Date().toISOString()}] Cron: Starting 5-minute invoice check`);

    // Create minimal NestJS app instance
    const app = await NestFactory.create(TransactionsModule, undefined, {
      logger: false, // Disable NestJS logger to reduce output
    });

    // Get the scheduler service
    const invoiceSchedulerService = app.get(InvoiceSchedulerService);

    // Process invoices that have been waiting 5+ minutes
    const startTime = Date.now();
    await invoiceSchedulerService.processPendingInvoiceChecks(5);
    const duration = Date.now() - startTime;

    console.log(`[${new Date().toISOString()}] Cron: Completed in ${duration}ms`);

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Processed invoices at 5min check',
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Cron Error:`,
      error instanceof Error ? error.message : 'Unknown error',
      error,
    );

    // Return error response (Vercel will retry on non-2xx)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
};
```

## 3. Service Implementation Details

### InvoiceSchedulerService Methods

```typescript
// src/transactions/services/invoice-scheduler.service.ts

@Injectable()
export class InvoiceSchedulerService {
  /**
   * Mark an invoice for periodic checking
   * Called immediately after invoice creation
   */
  async scheduleInvoiceChecks(qpayInvoiceId: string): Promise<void> {
    // Update invoice with scheduling metadata
    await this.esimInvoiceRepo.update(
      { qpayInvoiceId },
      {
        checkScheduledAt: new Date(),
        nextCheckTime: new Date(Date.now() + 5 * 60 * 1000),
      },
    );
  }

  /**
   * Process all invoices due for checking at this interval
   * Called by cron job handlers
   * 
   * @param checkIntervalMinutes - Only check invoices older than this
   */
  async processPendingInvoiceChecks(checkIntervalMinutes: number): Promise<void> {
    // Find invoices ready for checking
    const pendingInvoices = await this.esimInvoiceRepo.find({
      where: {
        checkScheduledAt: LessThan(
          new Date(Date.now() - checkIntervalMinutes * 60 * 1000)
        ),
        status: 'PENDING',
      },
    });

    // Process each invoice
    for (const esimInvoice of pendingInvoices) {
      await this.performInvoiceCheck(esimInvoice);
    }
  }

  /**
   * Check single invoice payment status
   */
  private async performInvoiceCheck(esimInvoice: EsimInvoice): Promise<void> {
    const qpayInvoiceId = esimInvoice.qpayInvoiceId;

    // 1. Check QPay for payment status
    const status = await this.qpayConnectionService.checkInvoice(qpayInvoiceId);
    const isPaid = status.rows?.some(r => r.payment_status === 'PAID');

    if (!isPaid) {
      this.logger.log(`Invoice ${qpayInvoiceId}: Still pending`);
      return; // Will be checked again next interval
    }

    // 2. Invoice is paid - place eSIM order automatically
    this.logger.log(`Invoice ${qpayInvoiceId}: Paid! Placing order...`);

    try {
      // Fetch package details
      const packages = await this.transactionsService.getPackageDetailsByCode(
        esimInvoice.packageCode,
      );

      // Create order
      const orderResult = await this.transactionsService.orderEsimForCustomer(
        qpayInvoiceId,
        {
          packageInfoList: [{
            packageCode: esimInvoice.packageCode,
            count: 1,
            price: packages[0].price,
          }],
        },
      );

      // Send email with eSIM details
      await this.transactionsService.queryEsimPurchases({
        orderNo: orderResult.orderNo,
      });

      this.logger.log(`Invoice ${qpayInvoiceId}: Order placed successfully`);
    } catch (error) {
      this.logger.error(`Invoice ${qpayInvoiceId}: Order failed`, error);
    }
  }
}
```

## 4. Database Queries

### Check Invoice Status

```sql
-- See all invoices scheduled for checking
SELECT 
  id,
  qpayInvoiceId,
  status,
  checkScheduledAt,
  nextCheckTime,
  created_at
FROM esim_invoices
WHERE checkScheduledAt IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

### Find Invoices Ready for Check

```sql
-- Find invoices due for 5-minute check
SELECT 
  id,
  qpayInvoiceId,
  status,
  EXTRACT(EPOCH FROM (NOW() - checkScheduledAt)) as seconds_waiting
FROM esim_invoices
WHERE checkScheduledAt IS NOT NULL
  AND status = 'PENDING'
  AND checkScheduledAt < NOW() - INTERVAL '5 minutes'
ORDER BY checkScheduledAt ASC;
```

### Monitor Processing

```sql
-- See recently processed invoices (last hour)
SELECT 
  id,
  qpayInvoiceId,
  status,
  checkScheduledAt,
  updatedAt,
  EXTRACT(EPOCH FROM (updatedAt - checkScheduledAt)) as processing_time_seconds
FROM esim_invoices
WHERE updatedAt > NOW() - INTERVAL '1 hour'
  AND status IN ('PROCESSED', 'PAID')
ORDER BY updatedAt DESC;
```

## 5. Testing Examples

### Test Invoice Creation with Scheduling

```typescript
// In your test file
describe('Invoice Scheduling', () => {
  it('should schedule checks when invoice is created', async () => {
    // Create invoice
    const invoice = await transactionsService.createInvoiceForPurchase(
      'customer-123',
      'PACKAGE-001',
    );

    // Verify it was marked for checking
    const savedInvoice = await esimInvoiceRepo.findOne({
      where: { id: invoice.id },
    });

    expect(savedInvoice.checkScheduledAt).toBeDefined();
    expect(savedInvoice.nextCheckTime).toBeDefined();
  });

  it('should process pending invoices', async () => {
    // Create test invoice
    const invoice = await esimInvoiceRepo.save({
      qpayInvoiceId: 'test-qpay-123',
      checkScheduledAt: new Date(Date.now() - 6 * 60 * 1000), // 6 min ago
      status: 'PENDING',
    });

    // Mock QPay to return PAID
    jest.spyOn(qpayConnectionService, 'checkInvoice').mockResolvedValue({
      count: 1,
      rows: [{ payment_status: 'PAID' }],
    });

    // Process
    await invoiceSchedulerService.processPendingInvoiceChecks(5);

    // Verify order was placed
    const order = await esimPurchaseRepo.findOne({
      where: { qpayInvoiceId: 'test-qpay-123' },
    });

    expect(order).toBeDefined();
  });
});
```

### Manual Cron Test

```bash
# Test 5-minute cron endpoint
curl -X GET http://localhost:3000/api/cron/invoice-check-5min \
  -H "Authorization: Bearer your-test-token"

# Expected response:
# {
#   "success": true,
#   "message": "Processed invoices at 5min check",
#   "duration": 245,
#   "timestamp": "2024-01-19T10:30:00.000Z"
# }
```

## 6. Environment Configuration

### Environment Variables (if needed)

```bash
# .env
NODE_ENV=production

# Vercel automatically provides:
# - VERCEL_ENV (production/preview/development)
# - VERCEL_URL (your deployed URL)

# Database credentials
DATABASE_HOST=your-db.c.vercel.com
DATABASE_PORT=5432
DATABASE_NAME=your_database
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password

# Optional: Logging
LOG_LEVEL=info
LOG_CRON_ENABLED=true
```

## 7. Error Handling

### Graceful Error Recovery

```typescript
async processPendingInvoiceChecks(checkIntervalMinutes: number): Promise<void> {
  try {
    const pendingInvoices = await this.esimInvoiceRepo.find({
      // ... query
    });

    // Track successes and failures
    let processed = 0;
    let failed = 0;

    for (const invoice of pendingInvoices) {
      try {
        await this.performInvoiceCheck(invoice);
        processed++;
      } catch (error) {
        // Don't stop processing other invoices
        this.logger.error(`Failed to process ${invoice.id}:`, error);
        failed++;
        // Could add retry logic here
      }
    }

    this.logger.info(
      `Invoice check completed: ${processed} succeeded, ${failed} failed`,
    );
  } catch (error) {
    // Database connection error, etc
    this.logger.error('Invoice check processing failed:', error);
    throw error; // Let cron handler see the error
  }
}
```

---

These examples show the complete integration path for implementing Vercel Cron Jobs for invoice auto-checking.
