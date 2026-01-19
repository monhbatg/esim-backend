# Vercel Cron Jobs for Invoice Auto-Check

This setup uses **Vercel Cron Jobs** to automatically check invoice payment status at scheduled intervals. This approach is perfect for serverless environments like Vercel.

## How It Works

### Architecture
1. **Invoice Creation** → Service marks invoice as "scheduled for checking" in the database
2. **Vercel Cron Jobs** → Call `/api/cron/invoice-check-*` endpoints on a schedule
3. **Background Processing** → Service queries database for pending invoices and processes them
4. **Auto Order Placement** → If invoice is paid, automatically order eSIM

### Schedule
- **Every 5 minutes**: `invoice-check-5min` - Check invoices waiting 5+ minutes
- **Every 10 minutes**: `invoice-check-10min` - Check invoices waiting 10+ minutes  
- **Every 15 minutes**: `invoice-check-15min` - Check invoices waiting 15+ minutes
- **Every 20 minutes**: `invoice-check-20min` - Check invoices waiting 20+ minutes

## Files Created/Modified

### 1. **Cron Job Routes** (New)
```
api/cron/invoice-check-5min.ts
api/cron/invoice-check-10min.ts
api/cron/invoice-check-15min.ts
api/cron/invoice-check-20min.ts
```
These serverless functions are called automatically by Vercel on schedule.

### 2. **Service Updates**
- `src/transactions/services/invoice-scheduler.service.ts`
  - `scheduleInvoiceChecks()` - Marks invoice for checking in database
  - `processPendingInvoiceChecks()` - Processes invoices due for checks (called by cron)

### 3. **Database Schema**
- Added to `esim_invoices` table:
  - `checkScheduledAt` - When the invoice was marked for checking
  - `nextCheckTime` - Next scheduled check time

### 4. **Configuration**
- `vercel.json` - Added cron job definitions

## Setup Instructions

### 1. Run Database Migration
```bash
npm run typeorm migration:run
```

Or manually add columns to `esim_invoices`:
```sql
ALTER TABLE esim_invoices ADD COLUMN checkScheduledAt TIMESTAMP NULL;
ALTER TABLE esim_invoices ADD COLUMN nextCheckTime TIMESTAMP NULL;
```

### 2. Update Invoice Creation
When creating an invoice, call the scheduler:
```typescript
// In your transaction controller/service
await this.invoiceSchedulerService.scheduleInvoiceChecks(qpayInvoiceId);
```

### 3. Deploy to Vercel
Cron jobs are automatically configured in `vercel.json`. Just deploy:
```bash
git push origin <branch>
# Or manually deploy
vercel --prod
```

## Monitoring

### View Cron Job Logs
In Vercel Dashboard → Your Project → Functions → Cron → Select specific cron job

### Check Success
- If successful: Returns `{ success: true, message: "..." }`
- If error: Returns `{ error: "..." }`

### Database Verification
```sql
-- Check which invoices have scheduled checks
SELECT id, qpayInvoiceId, checkScheduledAt, nextCheckTime, status 
FROM esim_invoices 
WHERE checkScheduledAt IS NOT NULL 
ORDER BY checkScheduledAt DESC;
```

## Cost & Performance

✅ **Zero Redis/Queue Required** - Uses database instead
✅ **Serverless Friendly** - Works perfectly in Vercel
✅ **Cost Effective** - Minimal function executions
✅ **Reliable** - Database-backed, survives server restarts

## Troubleshooting

### Cron jobs not running?
1. Check Vercel dashboard → Functions tab
2. Verify `/api/cron/` routes exist
3. Check logs for errors

### Invoices not being processed?
1. Verify `checkScheduledAt` is set when creating invoice
2. Check cron logs in Vercel dashboard
3. Verify database credentials in production

### Duplicate processing?
The service checks if invoice is already `PROCESSED` or `PAID` before ordering.

## Future Improvements

- Add retry logic for failed checks
- Implement exponential backoff
- Add email notifications for manual review
- Support webhook notifications from QPay
