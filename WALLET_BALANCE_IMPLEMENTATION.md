# Wallet Balance System Implementation

## Overview
This document describes the wallet balance system implementation for the eSIM backend. The system allows users to maintain a wallet balance that can be used for future transactions.

## Changes Made

### 1. User Entity (`src/entities/user.entity.ts`)
- Added `balance` column:
  - Type: `decimal(10, 2)` (stored as number in TypeScript)
  - Default: `0`
  - Precision: 10 digits total, 2 decimal places

### 2. DTOs Created

#### `AddBalanceDto` (`src/users/dto/add-balance.dto.ts`)
- Validates amount input for adding balance
- Requirements:
  - Must be a positive number
  - Minimum: 0.01
  - Maximum: 1,000,000
  - Up to 2 decimal places

#### `BalanceResponseDto` (`src/users/dto/balance-response.dto.ts`)
- Response DTO for balance queries
- Contains: `userId`, `balance`, `currency`

#### `AddBalanceResponseDto` (`src/users/dto/balance-response.dto.ts`)
- Extended from `BalanceResponseDto`
- Additional fields: `previousBalance`, `amountAdded`

#### `TransactionTypes` Enum (`src/users/dto/transaction-types.enum.ts`)
- Prepared for future TransactionModule integration
- Includes: `DEPOSIT`, `WITHDRAWAL`, `REFUND`, `TRANSFER`, `ADJUSTMENT`
- Includes: `TransactionStatus` enum

### 3. UsersService Methods (`src/users/users.service.ts`)

#### `addBalance(userId: string, amount: number): Promise<User>`
- Validates amount > 0
- Finds user by ID
- Increments user's balance
- Handles null/undefined balance (defaults to 0)
- Rounds to 2 decimal places to avoid floating point issues
- Returns updated user

#### `getBalance(userId: string): Promise<number>`
- Returns user's current balance
- Defaults to 0 if null/undefined
- Throws NotFoundException if user not found

#### `deductBalance(userId: string, amount: number): Promise<User>` (Bonus)
- Deducts balance from user's wallet
- Validates amount > 0
- Checks for sufficient balance
- Throws BadRequestException if insufficient balance
- Prepared for TransactionModule integration

#### `hasSufficientBalance(userId: string, amount: number): Promise<boolean>` (Bonus)
- Helper method to check if user has sufficient balance
- Returns boolean
- Useful for TransactionModule integration

#### `getBalanceWithCurrency(userId: string)` (Bonus)
- Returns balance with currency information
- Helper method for consistent balance retrieval

### 4. UsersController Endpoints (`src/users/users.controller.ts`)

#### `POST /users/user-profile/:id/add-balance`
- **Request Body:**
  ```json
  {
    "amount": 100.50
  }
  ```
- **Response:**
  ```json
  {
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "previousBalance": 50.25,
    "amountAdded": 100.50,
    "balance": 150.75,
    "currency": "USD"
  }
  ```
- **Error Responses:**
  - `400`: Invalid amount (must be > 0)
  - `401`: Unauthorized
  - `404`: User not found

#### `GET /users/user-profile/:id/balance`
- **Response:**
  ```json
  {
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "balance": 150.75,
    "currency": "USD"
  }
  ```
- **Error Responses:**
  - `401`: Unauthorized
  - `404`: User not found

### 5. UserProfileResponseDto Update (`src/users/dto/user-response.dto.ts`)
- Added `balance` field to profile response
- Added `preferredCurrency` field
- Balance is now included when fetching user profile

## Features

### Validation
- ✅ Amount validation using `class-validator`
- ✅ Minimum amount: 0.01
- ✅ Maximum amount: 1,000,000
- ✅ Decimal precision: 2 decimal places
- ✅ Positive number validation

### Error Handling
- ✅ 404 if user not found
- ✅ 400 if invalid amount (<= 0)
- ✅ 400 if insufficient balance (for deductBalance)
- ✅ Proper error messages

### Security
- ✅ JWT authentication required (via `JwtAuthGuard`)
- ✅ Input validation on all endpoints
- ✅ Type-safe operations

### Future-Ready
- ✅ `deductBalance` method prepared for TransactionModule
- ✅ `hasSufficientBalance` helper for transaction checks
- ✅ Transaction types enum for categorization
- ✅ Transaction status enum for state management
- ✅ Currency support via `preferredCurrency`

## Database Migration Note

⚠️ **Important**: You'll need to create a database migration to add the `balance` column to existing users. The column has a default value of 0, so existing users will automatically get a balance of 0.

Example migration (TypeORM):
```typescript
// Migration file
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.addColumn('users', new TableColumn({
    name: 'balance',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  }));
}
```

## Usage Examples

### Add Balance
```bash
POST /users/user-profile/{userId}/add-balance
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 100.50
}
```

### Get Balance
```bash
GET /users/user-profile/{userId}/balance
Authorization: Bearer {token}
```

### Get User Profile (includes balance)
```bash
GET /users/profile
Authorization: Bearer {token}
```

## Integration with TransactionModule (Future)

When implementing the TransactionModule, you can use:

1. `deductBalance()` - To deduct funds for purchases
2. `hasSufficientBalance()` - To check before processing transactions
3. `getBalanceWithCurrency()` - To get balance with currency info
4. `TransactionType` enum - To categorize transactions
5. `TransactionStatus` enum - To track transaction states

## Testing Recommendations

1. Test adding balance with valid amounts
2. Test adding balance with invalid amounts (0, negative, too large)
3. Test getting balance for existing and non-existing users
4. Test deducting balance with sufficient and insufficient funds
5. Test balance precision (decimal handling)
6. Test concurrent balance updates (if applicable)
7. Test authentication/authorization

## Notes

- Balance is stored as `decimal(10, 2)` in the database for precision
- All balance operations round to 2 decimal places
- Currency is derived from user's `preferredCurrency` field
- Default currency is 'USD' if not set
- The system is designed to be extended with a TransactionModule for full transaction history

