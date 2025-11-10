# Transaction History with eSIM Information

## Overview

The transaction history endpoint now includes eSIM purchase information when a transaction is for an eSIM purchase. This allows users to see what specific eSIM card they bought in their transaction history.

## Enhancement

### What Was Added

1. **eSIM Info in Transaction Response**
   - Added `esimInfo` field to `TransactionResponseDto`
   - Includes package code, name, data volume, duration, location, etc.
   - Only present for transactions that are eSIM purchases

2. **Automatic eSIM Loading**
   - Transaction history automatically loads associated eSIM purchases
   - Service method `getEsimPurchaseByTransactionId()` added
   - Efficiently loads eSIM data only when needed

3. **Enhanced Transaction Details**
   - Individual transaction endpoint also includes eSIM info
   - Users can see full eSIM details when viewing a specific transaction

## API Response Example

### Transaction History with eSIM Info

```http
GET /transactions?page=1&limit=10
Authorization: Bearer {token}
```

**Response:**
```json
{
  "transactions": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "transactionId": "TXN-20240101-ABC123",
      "userId": "user-uuid",
      "type": "WITHDRAWAL",
      "status": "COMPLETED",
      "amount": 57.00,
      "currency": "USD",
      "balanceBefore": 100.00,
      "balanceAfter": 43.00,
      "description": "Purchase eSIM: North America 1GB 7Days",
      "referenceId": "CKH491",
      "esimInfo": {
        "packageCode": "CKH491",
        "slug": "NA-3_1_7",
        "packageName": "North America 1GB 7Days",
        "dataVolume": 1073741824,
        "duration": 7,
        "durationUnit": "DAY",
        "location": "MX,US,CA",
        "description": "North America 1GB 7Days",
        "purchaseId": "purchase-uuid",
        "isActivated": false,
        "expiresAt": "2024-01-08T10:00:00.000Z"
      },
      "createdAt": "2024-01-01T10:00:00.000Z",
      "completedAt": "2024-01-01T10:00:01.000Z"
    },
    {
      "id": "another-transaction-id",
      "transactionId": "TXN-20240101-XYZ789",
      "type": "DEPOSIT",
      "status": "COMPLETED",
      "amount": 50.00,
      "esimInfo": null,  // No eSIM info for deposit transactions
      ...
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

## What Information is Shown

When a transaction is for an eSIM purchase, the `esimInfo` field includes:

- **Package Code**: e.g., "CKH491"
- **Slug**: e.g., "NA-3_1_7"
- **Package Name**: e.g., "North America 1GB 7Days"
- **Data Volume**: Data amount in bytes
- **Duration**: How long the eSIM is valid
- **Duration Unit**: DAY, MONTH, etc.
- **Location**: Covered countries
- **Description**: Package description
- **Purchase ID**: Link to full purchase record
- **Activation Status**: Whether eSIM has been activated
- **Expiration Date**: When the eSIM expires

## Implementation Details

### Service Layer

- `getUserTransactions()` now loads eSIM purchases for transactions
- Uses efficient batch loading to minimize database queries
- Maps eSIM purchases to transactions by `transactionId`

### Controller Layer

- `mapToResponseDto()` includes eSIM info when available
- Automatically includes eSIM details in transaction history
- Individual transaction endpoint also includes eSIM info

## Benefits

✅ **Complete Transaction Context** - Users see what they bought  
✅ **Easy Purchase Tracking** - Can identify eSIM purchases in history  
✅ **Full Package Details** - All eSIM information in one place  
✅ **Better UX** - No need to query separate endpoint for eSIM details  

## Usage

The enhancement is automatic - no changes needed to existing API calls. The `esimInfo` field will be:
- **Present** for transactions that are eSIM purchases
- **Null/undefined** for other transaction types (deposits, refunds, etc.)

## Files Modified

1. `src/transactions/dto/esim-info.dto.ts` - New DTO for eSIM info
2. `src/transactions/dto/transaction-response.dto.ts` - Added esimInfo field
3. `src/transactions/transactions.service.ts` - Enhanced to load eSIM purchases
4. `src/transactions/transactions.controller.ts` - Maps eSIM info to response

The transaction history now shows exactly what eSIM card was purchased! 🎉

