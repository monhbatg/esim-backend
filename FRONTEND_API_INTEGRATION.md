# Frontend API Integration Guide

## Base URL
```
http://localhost:3000  (Development)
https://your-api-domain.com  (Production)
```

## Authentication
All endpoints (except auth endpoints) require JWT authentication.

**Header:**
```
Authorization: Bearer {your_jwt_token}
```

---

## 🔐 Authentication Endpoints

### 1. Sign Up
```http
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

### 2. Sign In
```http
POST /auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

### 3. Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

---

## 💰 Wallet Endpoints

### 1. Get My Wallet Balance
```http
GET /wallet/me
Authorization: Bearer {token}

Response:
{
  "userId": "uuid",
  "balance": 150.75,
  "currency": "USD",
  "isActive": true,
  "isFrozen": false
}
```

### 2. Add Balance to Wallet
```http
POST /wallet/user-profile/:id/add-balance
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 100.50
}

Response:
{
  "userId": "uuid",
  "balance": 251.25,
  "currency": "USD",
  "previousBalance": 150.75,
  "amountAdded": 100.50
}
```

### 3. Get Wallet Balance by User ID
```http
GET /wallet/user-profile/:id/balance
Authorization: Bearer {token}

Response:
{
  "userId": "uuid",
  "balance": 150.75,
  "currency": "USD"
}
```

---

## 💳 Transaction Endpoints

### 1. Create Transaction
```http
POST /transactions
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "DEPOSIT",  // or "WITHDRAWAL", "REFUND", "TRANSFER", "ADJUSTMENT"
  "amount": 50.00,
  "currency": "USD",
  "description": "Deposit via credit card",
  "referenceId": "PAYMENT-12345",
  "metadata": {
    "paymentMethod": "credit_card",
    "cardLast4": "1234"
  }
}

Response:
{
  "id": "uuid",
  "transactionId": "TXN-20240101-ABC123",
  "userId": "uuid",
  "type": "DEPOSIT",
  "status": "COMPLETED",
  "amount": 50.00,
  "currency": "USD",
  "balanceBefore": 100.00,
  "balanceAfter": 150.00,
  "description": "Deposit via credit card",
  "createdAt": "2024-01-01T10:00:00.000Z",
  "completedAt": "2024-01-01T10:00:01.000Z"
}
```

### 2. Get Transaction History
```http
GET /transactions?page=1&limit=10&type=WITHDRAWAL&status=COMPLETED
Authorization: Bearer {token}

Query Parameters:
- page: number (default: 1)
- limit: number (default: 10)
- type: "DEPOSIT" | "WITHDRAWAL" | "REFUND" | "TRANSFER" | "ADJUSTMENT" (optional)
- status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" (optional)
- startDate: "2024-01-01" (optional, ISO date string)
- endDate: "2024-12-31" (optional, ISO date string)
- referenceId: string (optional)

Response:
{
  "transactions": [
    {
      "id": "uuid",
      "transactionId": "TXN-20240101-ABC123",
      "type": "WITHDRAWAL",
      "status": "COMPLETED",
      "amount": 57.00,
      "currency": "USD",
      "balanceBefore": 150.00,
      "balanceAfter": 93.00,
      "description": "Purchase eSIM: North America 1GB 7Days",
      "esimInfo": {
        "packageCode": "CKH491",
        "slug": "NA-3_1_7",
        "packageName": "North America 1GB 7Days",
        "dataVolume": 1073741824,
        "duration": 7,
        "durationUnit": "DAY",
        "location": "MX,US,CA",
        "isActivated": false,
        "expiresAt": "2024-01-08T10:00:00.000Z"
      },
      "createdAt": "2024-01-01T10:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

### 3. Get Transaction by ID
```http
GET /transactions/:transactionId
Authorization: Bearer {token}

Response:
{
  "id": "uuid",
  "transactionId": "TXN-20240101-ABC123",
  "type": "WITHDRAWAL",
  "status": "COMPLETED",
  "amount": 57.00,
  "esimInfo": { ... },  // If this is an eSIM purchase
  ...
}
```

### 4. Get Transaction Summary
```http
GET /transactions/me/summary
Authorization: Bearer {token}

Response:
{
  "totalTransactions": 50,
  "totalDeposits": 5,
  "totalWithdrawals": 45,
  "totalDepositAmount": 500.00,
  "totalWithdrawalAmount": 450.00,
  "currentBalance": 50.00,
  "currency": "USD"
}
```

---

## 📱 eSIM Purchase Endpoints

### 1. Purchase eSIM Card
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
  "description": "North America 1GB 7Days data plan",
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

Response:
{
  "transaction": {
    "id": "uuid",
    "transactionId": "TXN-20240101-ABC123",
    "type": "WITHDRAWAL",
    "status": "COMPLETED",
    "amount": 57.00,
    "balanceBefore": 150.00,
    "balanceAfter": 93.00,
    ...
  },
  "purchaseId": "uuid",
  "packageCode": "CKH491",
  "slug": "NA-3_1_7",
  "packageName": "North America 1GB 7Days",
  "price": 57.00,
  "currency": "USD",
  "dataVolume": 1073741824,
  "duration": 7,
  "durationUnit": "DAY",
  "location": "MX,US,CA",
  "isActivated": false,
  "isActive": true,
  "expiresAt": "2024-01-08T10:00:00.000Z",
  "purchasedAt": "2024-01-01T10:00:00.000Z"
}

Error Response (Insufficient Balance):
{
  "statusCode": 400,
  "message": "Insufficient balance. Current balance: 50.00, Required: 57.00",
  "error": "Bad Request"
}
```

### 2. Get My eSIM Purchases
```http
GET /transactions/my-esims
Authorization: Bearer {token}

Response:
[
  {
    "transaction": { ... },
    "purchaseId": "uuid",
    "packageCode": "CKH491",
    "packageName": "North America 1GB 7Days",
    "price": 57.00,
    "isActivated": false,
    "expiresAt": "2024-01-08T10:00:00.000Z",
    "purchasedAt": "2024-01-01T10:00:00.000Z",
    ...
  }
]
```

### 3. Get Specific eSIM Purchase
```http
GET /transactions/my-esims/:purchaseId
Authorization: Bearer {token}

Response:
{
  "transaction": { ... },
  "purchaseId": "uuid",
  "packageCode": "CKH491",
  "packageName": "North America 1GB 7Days",
  "price": 57.00,
  "dataVolume": 1073741824,
  "duration": 7,
  "durationUnit": "DAY",
  "location": "MX,US,CA",
  "iccid": "89012345678901234567",
  "isActivated": true,
  "activatedAt": "2024-01-02T10:00:00.000Z",
  "expiresAt": "2024-01-08T10:00:00.000Z",
  ...
}
```

---

## 📦 Inquiry Endpoints (for eSIM packages)

### 1. Get All Packages
```http
GET /inquiry/packages
Authorization: Bearer {token}
```

### 2. Search Packages by Country
```http
POST /inquiry/packages/country/:countryCode
Authorization: Bearer {token}
Content-Type: application/json

{
  "countryCode": "US"
}
```

### 3. Search Packages
```http
POST /inquiry/packages/search
Authorization: Bearer {token}
Content-Type: application/json

{
  "query": "North America",
  "filters": {
    "dataVolume": 1073741824,
    "duration": 7
  }
}
```

---

## 👤 User Endpoints

### 1. Get My Profile
```http
GET /users/me
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "isActive": true,
  "lastLoginAt": "2024-01-15T10:30:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "preferredCurrency": "USD",
  "preferences": {
    "preferredCurrency": "USD",
    "preferredLanguage": "en",
    "emailNotifications": true,
    "smsNotifications": false,
    "pushNotifications": true,
    "favoriteCountries": ["US", "CA", "MX"],
    "timezone": "America/New_York"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - User not found

---

### 2. Get User Profile (Alias)
```http
GET /users/profile
Authorization: Bearer {token}
```

**Response:** Same as `/users/me` above

---

### 3. Update Profile
```http
PATCH /users/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890"
}
```

**Request Body (all fields optional):**
```typescript
{
  firstName?: string;      // Min 2, Max 50 characters
  lastName?: string;        // Min 2, Max 50 characters
  phoneNumber?: string;     // Min 7, Max 20, must match phone format
}
```

**Response (200 OK):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "isActive": true,
  "lastLoginAt": "2024-01-15T10:30:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-15T11:00:00.000Z",
  "preferredCurrency": "USD",
  "preferences": { ... }
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors:
  ```json
  {
    "statusCode": 400,
    "message": [
      "firstName must be at least 2 characters long",
      "phoneNumber must match phone format"
    ],
    "error": "Bad Request"
  }
  ```
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - User not found

---

### 4. Change Password
```http
PUT /users/password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword456!",
  "confirmPassword": "NewSecurePassword456!"
}
```

**Request Body:**
```typescript
{
  currentPassword: string;  // Required - current password
  newPassword: string;      // Required - new password (min 8 chars, must contain uppercase, lowercase, number, special char)
  confirmPassword: string;  // Required - must match newPassword
}
```

**Response (200 OK):**
```json
{
  "message": "Password changed successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors or passwords don't match
- `401 Unauthorized` - Invalid current password or missing token
- `404 Not Found` - User not found

---

### 5. Get User Preferences
```http
GET /users/preferences
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "preferredCurrency": "USD",
  "preferredLanguage": "en",
  "emailNotifications": true,
  "smsNotifications": false,
  "pushNotifications": true,
  "favoriteCountries": ["US", "CA", "MX"],
  "timezone": "America/New_York"
}
```

---

### 6. Update User Preferences
```http
PUT /users/preferences
Authorization: Bearer {token}
Content-Type: application/json

{
  "preferredCurrency": "EUR",
  "preferredLanguage": "fr",
  "emailNotifications": true,
  "smsNotifications": true,
  "pushNotifications": false,
  "favoriteCountries": ["FR", "DE", "IT"],
  "timezone": "Europe/Paris"
}
```

**Request Body (all fields optional):**
```typescript
{
  preferredCurrency?: string;    // "USD" | "EUR" | "GBP" | "JPY" | "CNY"
  preferredLanguage?: string;    // Language code (e.g., "en", "fr", "es")
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  pushNotifications?: boolean;
  favoriteCountries?: string[];  // Array of country codes
  timezone?: string;              // IANA timezone (e.g., "America/New_York")
}
```

**Response (200 OK):**
```json
{
  "preferredCurrency": "EUR",
  "preferredLanguage": "fr",
  "emailNotifications": true,
  "smsNotifications": true,
  "pushNotifications": false,
  "favoriteCountries": ["FR", "DE", "IT"],
  "timezone": "Europe/Paris"
}
```

---

### 7. Get User Statistics
```http
GET /users/stats
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "totalPurchases": 15,
  "totalSpent": 855.00,
  "activeESims": 3,
  "countriesVisited": 8,
  "firstPurchaseAt": "2024-01-05T10:00:00.000Z",
  "lastPurchaseAt": "2024-01-15T14:30:00.000Z"
}
```

---

### 8. Delete Account
```http
DELETE /users/account
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "message": "Account deleted successfully"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - User not found

---

## 📘 TypeScript Type Definitions

Copy these types into your frontend project for type safety:

```typescript
// User Types
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  preferredCurrency?: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  preferredCurrency: string;
  preferredLanguage: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  favoriteCountries: string[];
  timezone: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

export interface UpdatePreferencesRequest {
  preferredCurrency?: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'AUD' | 'CAD' | 'CHF' | 'INR' | 'SGD';
  preferredLanguage?: 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'zh' | 'ko' | 'ar';
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  pushNotifications?: boolean;
  favoriteCountries?: string[];
  timezone?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UserStats {
  totalPurchases: number;
  totalSpent: number;
  activeESims: number;
  countriesVisited: number;
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
}
```

---

## 🔄 Frontend Integration Examples

### React/TypeScript Example

```typescript
// api.ts
const API_BASE_URL = 'http://localhost:3000';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // User Profile
  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/users/me');
  }

  async updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
    return this.request<UserProfile>('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getPreferences(): Promise<UserPreferences> {
    return this.request<UserPreferences>('/users/preferences');
  }

  async updatePreferences(data: UpdatePreferencesRequest): Promise<UserPreferences> {
    return this.request<UserPreferences>('/users/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
    return this.request<{ message: string }>('/users/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getUserStats(): Promise<UserStats> {
    return this.request<UserStats>('/users/stats');
  }

  async deleteAccount(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/users/account', {
      method: 'DELETE',
    });
  }

  // Wallet
  async getWallet() {
    return this.request('/wallet/me');
  }

  async addBalance(userId: string, amount: number) {
    return this.request(`/wallet/user-profile/${userId}/add-balance`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  // Transactions
  async getTransactions(params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/transactions?${query}`);
  }

  async getTransactionSummary() {
    return this.request('/transactions/me/summary');
  }

  // eSIM Purchase
  async purchaseEsim(packageData: {
    packageCode: string;
    slug: string;
    packageName: string;
    price: number;
    currency: string;
    dataVolume: number;
    duration: number;
    durationUnit: string;
    location: string;
    description?: string;
    packageMetadata?: any;
  }) {
    return this.request('/transactions/purchase-esim', {
      method: 'POST',
      body: JSON.stringify(packageData),
    });
  }

  async getMyEsimPurchases() {
    return this.request('/transactions/my-esims');
  }

  async getEsimPurchase(purchaseId: string) {
    return this.request(`/transactions/my-esims/${purchaseId}`);
  }
}

export const api = new ApiClient();
```

### React Hook Example

```typescript
// hooks/useWallet.ts
import { useState, useEffect } from 'react';
import { api } from '../api';

export function useWallet() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getWallet()
      .then(setWallet)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const addBalance = async (userId: string, amount: number) => {
    try {
      const updated = await api.addBalance(userId, amount);
      setWallet(updated);
      return updated;
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  return { wallet, loading, error, addBalance };
}
```

### React Component Example

```typescript
// components/PurchaseEsimButton.tsx
import { useState } from 'react';
import { api } from '../api';

export function PurchaseEsimButton({ packageData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePurchase = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.purchaseEsim(packageData);
      console.log('Purchase successful:', result);
      // Show success message, redirect, etc.
    } catch (err: any) {
      if (err.message.includes('Insufficient balance')) {
        setError('You don\'t have enough balance. Please add funds.');
      } else {
        setError('Purchase failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handlePurchase} disabled={loading}>
        {loading ? 'Processing...' : `Purchase for $${packageData.price}`}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

---

## 📝 Error Handling

All endpoints return errors in this format:

```json
{
  "statusCode": 400,
  "message": "Error message here",
  "error": "Bad Request"
}
```

Common Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors, insufficient balance)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (not authorized to access resource)
- `404` - Not Found
- `500` - Internal Server Error

---

## 🧪 Testing with cURL

```bash
# Sign in
curl -X POST http://localhost:3000/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get wallet (replace TOKEN with actual token)
curl -X GET http://localhost:3000/wallet/me \
  -H "Authorization: Bearer TOKEN"

# Purchase eSIM
curl -X POST http://localhost:3000/transactions/purchase-esim \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "packageCode": "CKH491",
    "slug": "NA-3_1_7",
    "packageName": "North America 1GB 7Days",
    "price": 57.00,
    "currency": "USD",
    "dataVolume": 1073741824,
    "duration": 7,
    "durationUnit": "DAY",
    "location": "MX,US,CA"
  }'
```

---

## 📚 Swagger Documentation

Access interactive API documentation at:
```
http://localhost:3000/api
```

This provides a visual interface to test all endpoints directly from the browser.

---

## 🔑 Key Points for Frontend Developers

1. **Always include JWT token** in Authorization header for protected endpoints
2. **Handle insufficient balance errors** gracefully (400 status with specific message)
3. **Transaction history includes eSIM info** - check `esimInfo` field for purchase details
4. **Use pagination** for transaction history (default: 10 items per page)
5. **Store tokens securely** (use httpOnly cookies or secure storage)
6. **Handle token expiration** - implement refresh token logic
7. **Validate amounts** on frontend before sending (must be positive, 2 decimal places max)

---

## 🚀 Quick Start Checklist

- [ ] Set up API base URL
- [ ] Implement authentication (sign in/sign up)
- [ ] Store JWT token securely
- [ ] Create API client/service
- [ ] Implement wallet balance display
- [ ] Implement transaction history
- [ ] Implement eSIM purchase flow
- [ ] Add error handling
- [ ] Add loading states
- [ ] Test with real API

