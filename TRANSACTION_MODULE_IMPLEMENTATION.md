# Transaction Module Implementation

## Overview

The Transaction Module provides a complete transaction system integrated with the Wallet module. It handles processing transactions, charging money from user wallets, and maintaining a full audit trail.

## Features

✅ **Unique Transaction IDs** - Auto-generated format: `TXN-YYYYMMDD-XXXXXX`  
✅ **Balance Validation** - Checks sufficient balance before processing  
✅ **Automatic Wallet Charging** - Deducts balance for WITHDRAWAL transactions  
✅ **Transaction History** - Full queryable history with filters  
✅ **Transaction Status Tracking** - PENDING → COMPLETED/FAILED  
✅ **Audit Trail** - Complete record of all balance changes  
✅ **Error Handling** - Proper error messages for insufficient balance  
✅ **Atomic Operations** - Database transactions ensure data consistency  

## Architecture

### Entity: Transaction
- **Unique Transaction ID**: `TXN-YYYYMMDD-XXXXXX` format
- **User & Wallet References**: Links to user and wallet
- **Type**: DEPOSIT, WITHDRAWAL, REFUND, TRANSFER, ADJUSTMENT
- **Status**: PENDING, COMPLETED, FAILED, CANCELLED
- **Balance Tracking**: Records balance before and after
- **Metadata**: Supports additional data and reference IDs

### Service: TransactionsService
- `processTransaction()` - Main method to create and process transactions
- `getTransactionById()` - Get transaction by ID
- `getUserTransactions()` - Get transaction history with filters
- `getTransactionByTransactionId()` - Get by unique transaction ID

### Controller: TransactionsController
- `POST /transactions` - Create and process transaction
- `GET /transactions` - Get transaction history (with filters)
- `GET /transactions/:transactionId` - Get specific transaction
- `GET /transactions/me/summary` - Get transaction summary

## Transaction Flow

### WITHDRAWAL Transaction (Charges Wallet)

1. **Validation**
   - Check if user has sufficient balance
   - Validate transaction amount and type
   - Throw error if balance insufficient

2. **Create Transaction Record**
   - Generate unique transaction ID
   - Create record with PENDING status
   - Record balance before transaction

3. **Process Transaction**
   - Deduct balance from wallet (via WalletService)
   - Update transaction status to COMPLETED
   - Record balance after transaction
   - Set completion timestamp

4. **Error Handling**
   - If deduction fails, mark transaction as FAILED
   - Record failure reason
   - Preserve balance before value

### DEPOSIT Transaction (Adds to Wallet)

1. Create transaction record
2. Add balance to wallet
3. Update transaction status
4. Record balances

## API Endpoints

### Create Transaction

```http
POST /transactions
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "WITHDRAWAL",
  "amount": 50.00,
  "description": "Purchase eSIM package",
  "referenceId": "ORDER-12345",
  "metadata": {
    "packageCode": "NA-3_1_7",
    "orderId": "12345"
  }
}
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "transactionId": "TXN-20240101-ABC123",
  "userId": "user-uuid",
  "type": "WITHDRAWAL",
  "status": "COMPLETED",
  "amount": 50.00,
  "currency": "USD",
  "balanceBefore": 100.00,
  "balanceAfter": 50.00,
  "description": "Purchase eSIM package",
  "referenceId": "ORDER-12345",
  "metadata": {
    "packageCode": "NA-3_1_7",
    "orderId": "12345"
  },
  "createdAt": "2024-01-01T10:00:00.000Z",
  "completedAt": "2024-01-01T10:00:01.000Z"
}
```

### Get Transaction History

```http
GET /transactions?type=WITHDRAWAL&status=COMPLETED&page=1&limit=10
Authorization: Bearer {token}
```

**Query Parameters:**
- `type`: Filter by transaction type (DEPOSIT, WITHDRAWAL, etc.)
- `status`: Filter by status (PENDING, COMPLETED, FAILED, CANCELLED)
- `startDate`: Filter from date (ISO 8601)
- `endDate`: Filter to date (ISO 8601)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

**Response:**
```json
{
  "transactions": [...],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

### Get Transaction by ID

```http
GET /transactions/TXN-20240101-ABC123
Authorization: Bearer {token}
```

### Get Transaction Summary

```http
GET /transactions/me/summary
Authorization: Bearer {token}
```

**Response:**
```json
{
  "totalTransactions": 50,
  "totalCompleted": 45,
  "totalFailed": 2,
  "totalPending": 3,
  "totalWithdrawn": 500.00,
  "totalDeposited": 1000.00
}
```

## Error Handling

### Insufficient Balance

**Request:**
```json
{
  "type": "WITHDRAWAL",
  "amount": 200.00
}
```

**Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Insufficient balance. Current balance: 50.00, Required: 200.00",
  "error": "Bad Request"
}
```

### Invalid Transaction Type

**Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": ["Transaction type must be a valid type"],
  "error": "Bad Request"
}
```

### Transaction Not Found

**Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Transaction not found",
  "error": "Not Found"
}
```

## Database Schema

### Transactions Table

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  transaction_id VARCHAR UNIQUE NOT NULL,  -- TXN-YYYYMMDD-XXXXXX
  user_id UUID NOT NULL,
  wallet_id UUID,
  type VARCHAR NOT NULL,  -- DEPOSIT, WITHDRAWAL, etc.
  status VARCHAR NOT NULL,  -- PENDING, COMPLETED, FAILED, CANCELLED
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR DEFAULT 'USD',
  balance_before DECIMAL(10,2),
  balance_after DECIMAL(10,2),
  description TEXT,
  reference_id VARCHAR,
  metadata JSONB,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL
);

CREATE INDEX idx_transactions_user_id_created_at ON transactions(user_id, created_at);
CREATE UNIQUE INDEX idx_transactions_transaction_id ON transactions(transaction_id);
CREATE INDEX idx_transactions_status_created_at ON transactions(status, created_at);
```

## Integration with Wallet Module

The Transaction Module integrates seamlessly with the Wallet Module:

1. **Uses WalletService** for balance operations
2. **Automatic Wallet Creation** - Creates wallet if doesn't exist
3. **Balance Validation** - Checks balance before processing
4. **Atomic Operations** - Uses database transactions
5. **Transaction Records** - Automatically created for all wallet operations

## Transaction Types

- **DEPOSIT**: Adds money to wallet
- **WITHDRAWAL**: Deducts money from wallet (with balance check)
- **REFUND**: Refunds money to wallet
- **TRANSFER**: Transfers between users (future)
- **ADJUSTMENT**: Admin adjustments (future)

## Security

- ✅ **JWT Authentication** - All endpoints require authentication
- ✅ **User Isolation** - Users can only access their own transactions
- ✅ **Input Validation** - All inputs validated with class-validator
- ✅ **Balance Checks** - Prevents overdrafts
- ✅ **Atomic Operations** - Database transactions prevent race conditions

## Usage Example

```typescript
// Create a withdrawal transaction (purchase eSIM)
const transaction = await transactionsService.processTransaction(userId, {
  type: TransactionType.WITHDRAWAL,
  amount: 50.00,
  description: 'Purchase eSIM package for North America',
  referenceId: 'ORDER-12345',
  metadata: {
    packageCode: 'NA-3_1_7',
    packageName: 'North America 1GB 7Days'
  }
});

// Check transaction status
if (transaction.status === TransactionStatus.COMPLETED) {
  console.log('Transaction successful!');
  console.log(`Balance: ${transaction.balanceAfter}`);
} else {
  console.log('Transaction failed:', transaction.failureReason);
}
```

## Files Created

1. `src/entities/transaction.entity.ts` - Transaction entity
2. `src/transactions/dto/create-transaction.dto.ts` - Create transaction DTO
3. `src/transactions/dto/transaction-response.dto.ts` - Response DTOs
4. `src/transactions/dto/query-transactions.dto.ts` - Query DTO
5. `src/transactions/transactions.service.ts` - Transaction service
6. `src/transactions/transactions.controller.ts` - Transaction controller
7. `src/transactions/transactions.module.ts` - Transaction module

## Next Steps

1. ✅ Run database migration to create transactions table
2. ✅ Test transaction creation
3. ✅ Test insufficient balance error
4. ✅ Test transaction history queries
5. 🔜 Add webhook support for transaction events
6. 🔜 Add admin endpoints for transaction management
7. 🔜 Add transaction export functionality

## Notes

- Transaction IDs are unique and auto-generated
- All transactions are logged for audit purposes
- Balance checks happen before wallet deduction
- Failed transactions preserve balance before value
- Transaction history is fully queryable and paginated

The Transaction Module is production-ready! 🎉

