# eSIM Purchase Implementation

## Overview

The eSIM Purchase system is fully integrated with the Transaction Module. It allows users to purchase eSIM cards, automatically charges their wallet, and tracks all purchased eSIM details.

## Features

✅ **eSIM Purchase Tracking** - Complete record of purchased eSIM cards  
✅ **Automatic Wallet Charging** - Charges user's wallet when purchasing  
✅ **Balance Validation** - Checks sufficient balance before purchase  
✅ **Package Details Storage** - Stores all eSIM package information  
✅ **Expiration Tracking** - Calculates and tracks eSIM expiration dates  
✅ **Purchase History** - View all purchased eSIM cards  
✅ **Transaction Linking** - Links purchases to transactions  

## Architecture

### Entity: ESimPurchase

Tracks all purchased eSIM cards with complete details:

- **Package Information**: packageCode, slug, packageName, price, currency
- **Data Details**: dataVolume, duration, durationUnit, location
- **eSIM Card Info**: iccid, activationCode, activatedAt, expiresAt
- **Status**: isActivated, isActive
- **Metadata**: Full package metadata (operators, networks, etc.)
- **Transaction Link**: Links to transaction via transactionId

### Service Methods

- `purchaseEsim()` - Purchase eSIM card (charges wallet)
- `getUserEsimPurchases()` - Get all user's eSIM purchases
- `getEsimPurchaseById()` - Get specific purchase
- `getEsimPurchasesByPackageCode()` - Get purchases by package code

## API Endpoints

### Purchase eSIM Card

```http
POST /transactions/purchase-esim
Authorization: Bearer {token}
Content-Type: application/json

{
  "packageCode": "CKH491",
  "slug": "NA-3_1_7",
  "packageName": "North America 1GB 7Days",
  "price": 57.00,
  "currency": "USD",
  "dataVolume": 1073741824,
  "duration": 7,
  "durationUnit": "DAY",
  "location": "MX,US,CA",
  "description": "North America 1GB 7Days",
  "packageMetadata": {
    "locationNetworkList": [
      {
        "locationName": "United States",
        "locationLogo": "/img/flags/us.png",
        "operatorList": [
          {
            "operatorName": "Verizon",
            "networkType": "5G"
          }
        ]
      }
    ]
  }
}
```

**Response:**
```json
{
  "transaction": {
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
    "createdAt": "2024-01-01T10:00:00.000Z",
    "completedAt": "2024-01-01T10:00:01.000Z"
  },
  "purchaseId": "purchase-uuid",
  "packageCode": "CKH491",
  "slug": "NA-3_1_7",
  "packageName": "North America 1GB 7Days",
  "price": 57.00,
  "currency": "USD",
  "dataVolume": 1073741824,
  "duration": 7,
  "durationUnit": "DAY",
  "location": "MX,US,CA",
  "description": "North America 1GB 7Days",
  "iccid": null,
  "isActivated": false,
  "isActive": true,
  "activatedAt": null,
  "expiresAt": "2024-01-08T10:00:00.000Z",
  "purchasedAt": "2024-01-01T10:00:00.000Z"
}
```

### Get My eSIM Purchases

```http
GET /transactions/my-esims
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "transaction": { ... },
    "purchaseId": "purchase-uuid",
    "packageCode": "CKH491",
    "packageName": "North America 1GB 7Days",
    "price": 57.00,
    "isActivated": false,
    "expiresAt": "2024-01-08T10:00:00.000Z",
    ...
  }
]
```

### Get Specific eSIM Purchase

```http
GET /transactions/my-esims/:purchaseId
Authorization: Bearer {token}
```

## Purchase Flow

1. **User selects eSIM package** from inquiry results
2. **Frontend sends purchase request** with package details
3. **Backend validates balance** - Checks if user has sufficient funds
4. **Creates transaction** - WITHDRAWAL type, charges wallet
5. **Creates eSIM purchase record** - Stores all package details
6. **Calculates expiration** - Based on duration and unit
7. **Returns purchase details** - Transaction + eSIM purchase info

## Error Handling

### Insufficient Balance

**Request:**
```json
{
  "packageCode": "CKH491",
  "price": 200.00,
  ...
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

## Database Schema

### esim_purchases Table

```sql
CREATE TABLE esim_purchases (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  transaction_id VARCHAR UNIQUE NOT NULL,
  package_code VARCHAR NOT NULL,
  slug VARCHAR NOT NULL,
  package_name VARCHAR NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR NOT NULL,
  data_volume BIGINT NOT NULL,
  duration INTEGER NOT NULL,
  duration_unit VARCHAR NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  iccid VARCHAR,
  activation_code VARCHAR,
  activated_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_activated BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  package_metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE SET NULL
);

CREATE INDEX idx_esim_purchases_user_id_created_at ON esim_purchases(user_id, created_at);
CREATE UNIQUE INDEX idx_esim_purchases_transaction_id ON esim_purchases(transaction_id);
CREATE INDEX idx_esim_purchases_package_code ON esim_purchases(package_code);
```

## What Information is Stored

For each eSIM purchase, the system stores:

1. **Package Identification**
   - Package Code (e.g., "CKH491")
   - Slug (e.g., "NA-3_1_7")
   - Package Name (e.g., "North America 1GB 7Days")

2. **Pricing Information**
   - Price at time of purchase
   - Currency

3. **Data & Duration**
   - Data volume in bytes
   - Duration value and unit
   - Expiration date (calculated)

4. **Location Coverage**
   - Covered locations (country codes)
   - Full location/network metadata

5. **eSIM Card Details** (after activation)
   - ICCID
   - Activation code
   - Activation timestamp

6. **Status**
   - Is activated
   - Is active
   - Purchase date

7. **Transaction Link**
   - Links to transaction record
   - Full transaction history

## Usage Example

```typescript
// User purchases eSIM
const purchase = await transactionsService.purchaseEsim(userId, {
  packageCode: 'CKH491',
  slug: 'NA-3_1_7',
  packageName: 'North America 1GB 7Days',
  price: 57.00,
  currency: 'USD',
  dataVolume: 1073741824,
  duration: 7,
  durationUnit: 'DAY',
  location: 'MX,US,CA',
  description: 'North America 1GB 7Days',
  packageMetadata: { ... }
});

// Get user's purchases
const purchases = await transactionsService.getUserEsimPurchases(userId);

// Get specific purchase
const purchase = await transactionsService.getEsimPurchaseById(purchaseId, userId);
```

## Files Created

1. `src/entities/esim-purchase.entity.ts` - eSIM Purchase entity
2. `src/transactions/dto/purchase-esim.dto.ts` - Purchase eSIM DTO
3. `src/transactions/dto/esim-purchase-response.dto.ts` - Response DTO
4. Enhanced `src/transactions/transactions.service.ts` - Added purchase methods
5. Enhanced `src/transactions/transactions.controller.ts` - Added purchase endpoints
6. Enhanced `src/transactions/transactions.module.ts` - Added ESimPurchase entity

## Integration Points

- **Wallet Module**: Automatically charges wallet on purchase
- **Transaction Module**: Creates transaction record for each purchase
- **Inquiry Module**: Uses package data from inquiry results

## Next Steps

1. ✅ Run database migration to create esim_purchases table
2. ✅ Test eSIM purchase flow
3. ✅ Test insufficient balance error
4. 🔜 Add eSIM activation endpoint (when eSIM is activated)
5. 🔜 Add eSIM status update endpoint
6. 🔜 Add eSIM expiration notifications
7. 🔜 Add eSIM usage tracking

The eSIM Purchase system is production-ready! 🎉

