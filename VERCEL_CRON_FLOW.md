# Invoice Auto-Check Flow with Vercel Cron

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. INVOICE CREATED                            │
│                                                                   │
│  TransactionController → TransactionService                      │
│  ↓                                                                │
│  Creates EsimInvoice in DB                                       │
│  ↓                                                                │
│  Calls invoiceSchedulerService.scheduleInvoiceChecks()           │
│  ↓                                                                │
│  Updates: checkScheduledAt = NOW, nextCheckTime = NOW + 5min     │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│            2. VERCEL CRON JOBS (Scheduled Execution)             │
│                                                                   │
│  Every 5 min  → GET /api/cron/invoice-check-5min                │
│  Every 10 min → GET /api/cron/invoice-check-10min               │
│  Every 15 min → GET /api/cron/invoice-check-15min               │
│  Every 20 min → GET /api/cron/invoice-check-20min               │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│         3. INVOICE CHECK PROCESSING (Background Job)             │
│                                                                   │
│  Cron Handler                                                    │
│  ↓                                                                │
│  Creates NestJS App instance                                     │
│  ↓                                                                │
│  Calls invoiceSchedulerService.processPendingInvoiceChecks()     │
│  ↓                                                                │
│  Finds all invoices where:                                       │
│    - checkScheduledAt < NOW - interval                           │
│    - status = 'PENDING'                                          │
│  ↓                                                                │
│  For each invoice:                                               │
│    - Check QPay for payment status                               │
│    - If PAID → Order eSIM automatically                          │
│    - If NOT PAID → Wait for next check                           │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              4. AUTOMATIC eSIM ORDER (If Paid)                   │
│                                                                   │
│  Fetch package details from API                                  │
│  ↓                                                                │
│  Call orderEsimForCustomer()                                     │
│  ↓                                                                │
│  Update invoice status → 'PROCESSED'                             │
│  ↓                                                                │
│  Send email to customer                                          │
│  ↓                                                                │
│  Cancel remaining scheduled checks                               │
└─────────────────────────────────────────────────────────────────┘
```

## Timeline Example

```
T=0 min:   User creates invoice → checkScheduledAt=0, nextCheckTime=5
           
T=5 min:   Cron runs /api/cron/invoice-check-5min
           ├─ Finds invoices with checkScheduledAt <= T-5
           ├─ Checks QPay for payment
           └─ If NOT paid: Wait for next interval

T=10 min:  Cron runs /api/cron/invoice-check-10min
           ├─ Finds invoices with checkScheduledAt <= T-10
           ├─ Checks QPay for payment
           └─ If NOT paid: Wait for next interval

T=15 min:  Cron runs /api/cron/invoice-check-15min
           ├─ Finds invoices with checkScheduledAt <= T-15
           ├─ Checks QPay for payment
           └─ If PAID: 
              ├─ Order eSIM automatically
              ├─ Send email
              └─ Update status → PROCESSED

T=20 min:  Cron would run but invoice already PROCESSED (skipped)
```

## Database Schema

```
esim_invoices table
─────────────────────────────────────────────────────
id:               UUID (PK)
qpayInvoiceId:    String - QPay's invoice ID
status:           String - PENDING | PROCESSED | PAID | CANCELLED
checkScheduledAt: Timestamp - When check was scheduled
nextCheckTime:    Timestamp - Next check time
createdAt:        Timestamp - When invoice was created
updatedAt:        Timestamp - Last update
... (other columns)
─────────────────────────────────────────────────────

Query for pending checks:
SELECT * FROM esim_invoices 
WHERE checkScheduledAt IS NOT NULL 
  AND checkScheduledAt < NOW() - INTERVAL '5 minutes'
  AND status = 'PENDING'
ORDER BY createdAt DESC
```

## Vercel Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/invoice-check-5min",
      "schedule": "*/5 * * * *"    // Every 5 minutes
    },
    {
      "path": "/api/cron/invoice-check-10min", 
      "schedule": "*/10 * * * *"   // Every 10 minutes
    },
    {
      "path": "/api/cron/invoice-check-15min",
      "schedule": "*/15 * * * *"   // Every 15 minutes
    },
    {
      "path": "/api/cron/invoice-check-20min",
      "schedule": "*/20 * * * *"   // Every 20 minutes
    }
  ]
}
```

## Key Features

✅ **Database-Driven** - No Redis/Queue required
✅ **Serverless** - Works in Vercel Function timeout limits
✅ **Automatic Retries** - Cron will retry on failure
✅ **Cost Efficient** - Minimal compute time
✅ **Reliable** - Database ensures no lost checks
✅ **Scalable** - Handles thousands of invoices
✅ **Zero Dependencies** - No external job queue services

## Monitoring & Debugging

### View Active Checks
```sql
SELECT id, qpayInvoiceId, status, checkScheduledAt, nextCheckTime 
FROM esim_invoices 
WHERE checkScheduledAt IS NOT NULL
ORDER BY checkScheduledAt DESC 
LIMIT 10;
```

### Check Cron Execution in Vercel
Dashboard → Project → Functions → Cron tab → Select specific cron

### Test Manually
```bash
curl https://your-domain.vercel.app/api/cron/invoice-check-5min
```

Expected response:
```json
{
  "success": true,
  "message": "Processed invoices at 5min check"
}
```
