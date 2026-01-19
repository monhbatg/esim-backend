# Invoice Auto-Check Implementation Checklist

## Phase 1: Code Setup ✅ COMPLETED

- [x] Created `InvoiceSchedulerService` with new methods
  - [x] `scheduleInvoiceChecks()` - Marks invoice for checking
  - [x] `processPendingInvoiceChecks()` - Processes pending checks (called by cron)
  - [x] `performInvoiceCheck()` - Checks payment status

- [x] Created Vercel cron API routes
  - [x] `api/cron/invoice-check-5min.ts`
  - [x] `api/cron/invoice-check-10min.ts`
  - [x] `api/cron/invoice-check-15min.ts`
  - [x] `api/cron/invoice-check-20min.ts`

- [x] Updated database schema
  - [x] Added `checkScheduledAt` column
  - [x] Added `nextCheckTime` column
  - [x] Created migration file

- [x] Configuration
  - [x] Updated `vercel.json` with cron jobs
  - [x] Removed Bull Queue from modules
  - [x] Cleaned up dependencies

## Phase 2: Database Migration

### Before Deployment
Run this command locally first:
```bash
npm run typeorm migration:run
```

Or manually in your database:
```sql
ALTER TABLE esim_invoices ADD COLUMN checkScheduledAt TIMESTAMP NULL;
ALTER TABLE esim_invoices ADD COLUMN nextCheckTime TIMESTAMP NULL;
CREATE INDEX idx_esim_invoices_check_scheduled ON esim_invoices(checkScheduledAt, status);
```

### Production Database
- [ ] Backup database before migration
- [ ] Run migration in production after code is deployed
- [ ] Verify columns exist: `\d esim_invoices` (PostgreSQL)

## Phase 3: Code Integration

### Step 1: Update Invoice Creation
In your `TransactionsController` or `TransactionsService` where you create invoices:

```typescript
// After creating EsimInvoice
const esimInvoice = await this.esimInvoiceRepo.save(invoice);

// Schedule automatic checks
await this.invoiceSchedulerService.scheduleInvoiceChecks(esimInvoice.qpayInvoiceId);
```

### Step 2: Inject InvoiceSchedulerService
Make sure the service is injected where needed:

```typescript
constructor(
  private readonly invoiceSchedulerService: InvoiceSchedulerService,
  // ... other dependencies
) {}
```

## Phase 4: Testing (Local)

### Test Manually
1. Create an invoice via API
2. Check database for `checkScheduledAt` timestamp
3. Call cron manually:
   ```bash
   curl http://localhost:3000/api/cron/invoice-check-5min
   ```
4. Verify logs show processing

### Test with Database Query
```bash
# Check invoices marked for checking
SELECT id, qpayInvoiceId, status, checkScheduledAt 
FROM esim_invoices 
WHERE checkScheduledAt IS NOT NULL 
ORDER BY createdAt DESC LIMIT 5;
```

### Mock Payment Status
For testing, you can temporarily modify the QPay check to return PAID:
```typescript
// In invoice-scheduler.service.ts processPendingInvoiceChecks()
// Add for testing:
if (process.env.NODE_ENV === 'development') {
  // Return mock PAID status for testing
  invoiceStatus = { count: 1, rows: [{ payment_status: 'PAID' }] };
}
```

## Phase 5: Deployment to Vercel

### Step 1: Prepare Release
```bash
git add .
git commit -m "feat: Add Vercel Cron Jobs for invoice auto-check"
git push origin <your-branch>
```

### Step 2: Deploy
Option A - Via Vercel CLI:
```bash
vercel --prod
```

Option B - Via Git push:
```bash
git push origin main  # or your production branch
```

### Step 3: Verify in Vercel Dashboard
1. Go to Vercel Project Dashboard
2. Navigate to Functions tab
3. Look for "Cron" section
4. Should see 4 cron jobs listed
5. Check "Next Invocation" time for each

### Step 4: Monitor Logs
```bash
# Watch logs in real-time
vercel logs --follow
```

## Phase 6: Production Verification

### Check Cron Executions
1. Vercel Dashboard → Functions → Cron
2. Each cron should show recent invocations
3. Status should be "Success" (with 200 response)

### Database Verification
```sql
-- Check for invoices being processed
SELECT 
  id, qpayInvoiceId, status, 
  checkScheduledAt, 
  EXTRACT(EPOCH FROM (NOW() - checkScheduledAt)) as seconds_since_check
FROM esim_invoices 
WHERE checkScheduledAt IS NOT NULL 
ORDER BY checkScheduledAt DESC 
LIMIT 10;
```

### Monitor eSIM Orders
Check if invoices are being automatically converted to orders:
```sql
-- Invoices that became processed recently
SELECT id, qpayInvoiceId, status, updatedAt 
FROM esim_invoices 
WHERE status IN ('PROCESSED', 'PAID')
AND updatedAt > NOW() - INTERVAL '1 hour'
ORDER BY updatedAt DESC;
```

## Phase 7: Troubleshooting

### Crons Not Running?
- [ ] Check Vercel deployment status (green)
- [ ] Verify `vercel.json` syntax is correct
- [ ] Check that API routes exist: `api/cron/invoice-check-*.ts`
- [ ] Verify routes are properly formatted TypeScript

### Invoices Not Being Processed?
- [ ] Check if `checkScheduledAt` is being set
  ```sql
  SELECT COUNT(*) FROM esim_invoices WHERE checkScheduledAt IS NULL;
  ```
- [ ] Check Vercel logs for cron execution errors
- [ ] Verify database connection works in Vercel Functions
- [ ] Check QPay service is reachable from Vercel

### Duplicate Processing?
- [ ] Service checks for `status IN ('PROCESSED', 'PAID')` 
- [ ] If duplicates still occur, add unique constraint on transactions

## Phase 8: Optimization (Optional)

### Add Indexing for Performance
```sql
-- Speed up invoice check queries
CREATE INDEX idx_esim_invoices_check_status 
ON esim_invoices(checkScheduledAt, status) 
WHERE status = 'PENDING';

-- Speed up QPay invoice lookups
CREATE INDEX idx_esim_invoices_qpay_id 
ON esim_invoices(qpayInvoiceId);
```

### Monitor Cron Costs
- Each cron takes ~100-500ms execution time
- 4 crons every hour = minimal cost
- Estimated cost: <$1/month on Vercel

### Add Alerts (Optional)
In Vercel dashboard, set up alerts for:
- Cron job failures
- High execution time (>5 seconds)
- Function timeouts

## Rollback Plan

If issues occur:

1. **Disable Crons**: Remove from `vercel.json` and redeploy
2. **Revert Service**: Restore original `invoice-scheduler.service.ts`
3. **Database**: Columns can be left as-is (just won't be used)

```bash
# Revert last commit
git revert HEAD
git push origin main
```

## Post-Deployment

### Document for Team
- [ ] Share this checklist with team
- [ ] Document cron job endpoints in API docs
- [ ] Add monitoring alerts
- [ ] Schedule regular log reviews

### Monitor First Week
- [ ] Check cron logs daily
- [ ] Monitor invoice processing rate
- [ ] Watch for any error patterns
- [ ] Verify eSIM orders are placed correctly

### Success Metrics
✅ All 4 crons executing successfully
✅ Invoices marked with `checkScheduledAt`
✅ Invoices automatically processed when payment received
✅ Zero duplicate orders placed
✅ eSIM delivery emails sent correctly
